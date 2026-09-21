import { camelRows, compile, Frag, type Row, type Sql } from "./sql";

/**
 * Database access.
 *
 *  - DATABASE_URL set  → `postgres` (works with Supabase's transaction pooler)
 *  - DATABASE_URL blank → embedded PGlite in .data/pglite (local demo only)
 *
 * Both expose exactly the same API, so the rest of the app never knows which.
 */

type RawQuery = (text: string, params: unknown[]) => Promise<Row[]>;

interface Backend {
  kind: "postgres" | "pglite";
  query: RawQuery;
  tx<T>(fn: (q: RawQuery) => Promise<T>): Promise<T>;
  exec(text: string): Promise<void>;
  end(): Promise<void>;
}

export interface Db {
  kind: Backend["kind"];
  sql: Sql;
  tx<T>(fn: (sql: Sql) => Promise<T>): Promise<T>;
  exec(text: string): Promise<void>;
  end(): Promise<void>;
}

function makeSql(q: RawQuery): Sql {
  return (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const { text, params } = compile(strings, values);
    return camelRows(await q(text, params));
  }) as Sql;
}

function wrap(backend: Backend): Db {
  return {
    kind: backend.kind,
    sql: makeSql(backend.query),
    tx: (fn) => backend.tx((q) => fn(makeSql(q))),
    exec: backend.exec,
    end: backend.end,
  };
}

async function postgresBackend(url: string): Promise<Backend> {
  const { default: postgres } = await import("postgres");
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  const open = () =>
    postgres(url, {
      // Supabase's transaction pooler (pgbouncer) has no prepared statements.
      prepare: false,
      max: 5,
      idle_timeout: 20,
      max_lifetime: 60 * 10,
      connect_timeout: 15,
      ssl: isLocal ? false : "require",
      onnotice: () => {},
    });
  let pg = open();

  // A serverless instance that was frozen between requests can wake up holding a connection the pooler
  // already closed. Without a limit the first query then waits for minutes. So: cap every query, and when
  // one hangs, throw the pool away. Reads are retried once on a fresh pool; writes are never retried
  // (we can't know whether they landed), they fail fast so the person just taps again.
  const reset = () => {
    const old = pg;
    pg = open();
    void old.end({ timeout: 0 }).catch(() => {});
  };
  const guarded = async <T>(run: (p: ReturnType<typeof open>) => Promise<T>, retry: boolean, limitMs = 8000): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          run(pg),
          new Promise<never>((_, rej) => {
            timer = setTimeout(() => rej(new Error("DB_TIMEOUT")), limitMs);
          }),
        ]);
      } catch (e) {
        if (!(e instanceof Error) || e.message !== "DB_TIMEOUT") throw e;
        reset();
        if (!retry || attempt > 0) throw new Error("The database took too long to answer. Please try again.");
      } finally {
        clearTimeout(timer);
      }
    }
  };
  const isRead = (text: string) => /^\s*(select|with)\b/i.test(text) && !/\b(insert|update|delete)\b/i.test(text);

  return {
    kind: "postgres",
    query: (text, params) => guarded(async (p) => [...(await p.unsafe(text, params as never[]))] as Row[], isRead(text)),
    tx: (fn) =>
      guarded((p) => p.begin(async (t) => fn(async (text, params) => [...(await t.unsafe(text, params as never[]))] as Row[])) as never, false, 20000),
    // exec runs whole migration files and seeds: no cap.
    exec: async (text) => {
      await pg.unsafe(text);
    },
    end: async () => {
      await pg.end({ timeout: 5 });
    },
  };
}

async function pgliteBackend(dataDir: string | undefined): Promise<Backend> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(dataDir);
  await pg.waitReady;
  return {
    kind: "pglite",
    query: async (text, params) => (await pg.query<Row>(text, params as never[])).rows,
    tx: (fn) => pg.transaction((t) => fn(async (text, params) => (await t.query<Row>(text, params as never[])).rows)),
    exec: async (text) => {
      await pg.exec(text);
    },
    end: async () => {
      await pg.close();
    },
  };
}

const g = globalThis as unknown as { __kacDb?: Promise<Db>; __kacMigSig?: string; __kacMigLock?: Promise<void> };

/** Create a fresh connection (used by scripts and tests; the app uses `db()`). */
export async function connect(opts: { url?: string; dataDir?: string | null } = {}): Promise<Db> {
  const url = opts.url ?? process.env.DATABASE_URL;
  if (url) return wrap(await postgresBackend(url));
  const dir = opts.dataDir === undefined ? ".data/pglite" : (opts.dataDir ?? undefined);
  if (dir) (await import("node:fs")).mkdirSync(".data", { recursive: true });
  return wrap(await pgliteBackend(dir));
}

/** The shared, ready-to-use database for this server process. */
export function db(): Promise<Db> {
  if (!g.__kacDb) {
    g.__kacDb = (async () => {
      if (!process.env.DATABASE_URL && process.env.VERCEL) {
        throw new Error(
          "DATABASE_URL is not set. Add your Supabase pooler connection string in Vercel → Settings → Environment Variables.",
        );
      }
      const conn = await connect();
      if (conn.kind === "pglite") {
        // Zero-config demo mode: migrate + seed demo data on first boot.
        const { prepareEmbedded } = await import("./embedded");
        await prepareEmbedded(conn);
      }
      return conn;
    })().catch((err) => {
      g.__kacDb = undefined; // allow retry on the next request
      throw err;
    });
  }
  return g.__kacDb.then(keepEmbeddedMigrated);
}

/**
 * Embedded demo DB only: `next dev` hot-reloads code but keeps this connection alive, so a new
 * migration file (from pulling changes or editing the schema) would otherwise leave new code
 * running against an old schema until a manual restart. Applying pending migrations here makes
 * that a non-event. Real Postgres/Supabase is NEVER auto-migrated: that stays an explicit
 * `npm run db:migrate`.
 */
async function keepEmbeddedMigrated(conn: Db): Promise<Db> {
  if (conn.kind !== "pglite") return conn;
  const [{ readdirSync }, path] = await Promise.all([import("node:fs"), import("node:path")]);
  const sig = readdirSync(path.join(process.cwd(), "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort().join(",");
  if (g.__kacMigSig === sig) return conn;
  g.__kacMigLock ??= (async () => {
    const { migrate } = await import("./migrate");
    await migrate(conn, (m) => console.log(`[db] ${m}`));
    g.__kacMigSig = sig;
  })().finally(() => {
    g.__kacMigLock = undefined;
  });
  await g.__kacMigLock;
  return conn;
}

/** Top-level convenience: `await sql\`select …\``. */
export const sql: Sql = (async (strings: TemplateStringsArray, ...values: unknown[]) =>
  (await db()).sql(strings, ...values)) as Sql;

/** Run several statements atomically. */
export async function tx<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  return (await db()).tx(fn);
}

export { Frag };
