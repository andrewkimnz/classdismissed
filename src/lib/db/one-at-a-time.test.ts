import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { connect } from "./client";

/**
 * Supabase's pooler hangs or drops connections when the driver sends it several queries down one connection at once.
 * This puts a small proxy between the app and a real Postgres and measures it: no connection may ever have more
 * than one statement in flight, however many queries run in parallel. Needs TEST_DATABASE_URL (skipped without it).
 */
const REAL = process.env.TEST_DATABASE_URL;

describe("database connections take one query at a time", { skip: !REAL }, () => {
  const proxy = net.createServer();
  const state = { peak: 0, connections: 0 };
  after(() => {
    proxy.close();
  });

  it("never has two statements in flight on one connection (60 parallel queries + transactions)", async () => {
    const target = new URL(REAL!);
    proxy.on("connection", (client) => {
      state.connections++;
      const server = net.connect(Number(target.port || 5432), target.hostname);
      let inFlight = 0;
      let fromClient = Buffer.alloc(0);
      let fromServer = Buffer.alloc(0);
      let started = false;
      client.on("data", (d) => {
        server.write(d);
        fromClient = Buffer.concat([fromClient, d]);
        if (!started) { // the first packet has no type byte
          if (fromClient.length < 4 || fromClient.length < fromClient.readInt32BE(0)) return;
          fromClient = fromClient.subarray(fromClient.readInt32BE(0));
          started = true;
        }
        while (fromClient.length >= 5 && fromClient.length >= 1 + fromClient.readInt32BE(1)) {
          const type = String.fromCharCode(fromClient[0]);
          if (type === "S" || type === "Q") state.peak = Math.max(state.peak, ++inFlight); // Sync / simple Query
          fromClient = fromClient.subarray(1 + fromClient.readInt32BE(1));
        }
      });
      server.on("data", (d) => {
        client.write(d);
        fromServer = Buffer.concat([fromServer, d]);
        while (fromServer.length >= 5 && fromServer.length >= 1 + fromServer.readInt32BE(1)) {
          if (String.fromCharCode(fromServer[0]) === "Z") inFlight = Math.max(0, inFlight - 1); // ReadyForQuery
          fromServer = fromServer.subarray(1 + fromServer.readInt32BE(1));
        }
      });
      client.on("close", () => server.destroy());
      server.on("close", () => client.destroy());
      client.on("error", () => {});
      server.on("error", () => {});
    });
    await new Promise<void>((ok) => proxy.listen(0, "127.0.0.1", ok));
    const url = new URL(REAL!);
    url.hostname = "127.0.0.1";
    url.port = String((proxy.address() as net.AddressInfo).port);

    const conn = await connect({ url: url.toString() });
    try {
      await Promise.all([
        // no parameters, like the event-data queries: those are the ones the driver pipelines
        ...Array.from({ length: 60 }, () => conn.sql`select 1 as n, pg_sleep(0.03)`),
        ...Array.from({ length: 6 }, () => conn.tx(async (q) => {
          await q`select 1 as n`;
          await q`select pg_sleep(0.03)`;
        })),
      ]);
    } finally {
      await conn.end();
    }
    assert.ok(state.connections > 1, "the test should have used several connections");
    assert.equal(state.peak, 1, `a connection had ${state.peak} statements in flight at once`);
  });
});
