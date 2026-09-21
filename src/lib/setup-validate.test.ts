import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkAdminPassword, checkDatabaseUrl, checkProjectUrl, checkPublicKey, checkSecretKey, jwtRole, mask } from "./setup-validate";

const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.sig_abc-123`;
const REF = "abcdefghijklmnopqrst";
const POOL = (port = 6543, pw = "s3cret") => `postgresql://postgres.${REF}:${pw}@aws-0-ap-southeast-2.pooler.supabase.com:${port}/postgres`;

describe("setup: keys can't be put in the wrong slot", () => {
  it("rejects a secret key in the PUBLIC slot (it would ship to every phone)", () => {
    assert.equal(checkPublicKey("sb_secret_" + "x".repeat(30)).ok, false);
    assert.equal(checkPublicKey(jwt("service_role")).ok, false);
  });
  it("rejects a public key in the SECRET slot, and the same value twice", () => {
    const pub = "sb_publishable_" + "y".repeat(30);
    assert.equal(checkSecretKey(pub, "other").ok, false);
    assert.equal(checkSecretKey(jwt("anon"), "other").ok, false);
    assert.equal(checkSecretKey("sb_secret_" + "z".repeat(30), "sb_secret_" + "z".repeat(30)).ok, false);
  });
  it("accepts the right keys (new and legacy)", () => {
    assert.equal(checkPublicKey("sb_publishable_" + "a".repeat(30)).ok, true);
    assert.equal(checkSecretKey("sb_secret_" + "b".repeat(30), "sb_publishable_" + "a".repeat(30)).ok, true);
    const anon = checkPublicKey(jwt("anon"));
    assert.ok(anon.ok && anon.warn);
    assert.equal(checkSecretKey(jwt("service_role"), jwt("anon")).ok, true);
    assert.equal(jwtRole(jwt("anon")), "anon");
  });
  it("rejects junk", () => {
    for (const j of ["", "hello", "sb_publishable_", "https://x"]) assert.equal(checkPublicKey(j).ok, false);
  });
});

describe("setup: connection string and project", () => {
  it("accepts the transaction pooler and reads the project ref", () => {
    assert.equal(checkDatabaseUrl(POOL(), REF).ok, true);
    const p = checkProjectUrl(`https://${REF}.supabase.co/`);
    assert.ok(p.ok && p.ref === REF);
  });
  it("rejects the placeholder password, the direct connection, and a different project", () => {
    assert.equal(checkDatabaseUrl(POOL(6543, "[YOUR-PASSWORD]")).ok, false);
    assert.equal(checkDatabaseUrl(`postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres`).ok, false);
    const other = checkDatabaseUrl(POOL().replace(REF, "zzzzzzzzzzzzzzzzzzzz"), REF);
    assert.ok(!other.ok && /different Supabase project/.test(other.error));
  });
  it("explains an un-encoded special character in the password", () => {
    const r = checkDatabaseUrl("postgresql://postgres.abc:pa#ss@host.pooler.supabase.com:6543/postgres");
    assert.ok(!r.ok && /URL-encoded/.test(r.error));
    assert.equal(checkDatabaseUrl(POOL(6543, "pa%23ss"), REF).ok, true, "an encoded # is fine");
  });
  it("warns (doesn't block) on the session pooler port", () => {
    const r = checkDatabaseUrl(POOL(5432), REF);
    assert.ok(r.ok && r.warn);
  });
  it("rejects a malformed project URL", () => {
    for (const u of ["http://x.supabase.co", "https://example.com", "abcdefghijklmnopqrst"]) assert.equal(checkProjectUrl(u).ok, false);
  });
});

describe("setup: admin password and masking", () => {
  it("needs 10+ characters", () => {
    assert.equal(checkAdminPassword("short").ok, false);
    assert.equal(checkAdminPassword("a-decent-passphrase").ok, true);
  });
  it("never reveals a secret: only the kind and length", () => {
    const shown = mask("sb_secret_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345");
    assert.ok(!shown.includes("ABCDEFG"), shown);
    assert.match(shown, /sb_secret_… \(\d+ characters\)/);
  });
});
