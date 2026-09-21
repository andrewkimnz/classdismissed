/**
 * A tiny tagged-template SQL builder shared by both database backends.
 *
 *   await sql<Student>`select * from students where id = ${id}`
 *   await sql`... where id in (${list(ids)})`
 *
 * Only scalars and JSON ever travel as parameters (never JS arrays), which keeps
 * behaviour identical across `postgres` (Supabase) and PGlite (embedded demo).
 * Pass JSON as an object and cast it: `${{ a: 1 }}::jsonb`.
 *
 * Why objects are emitted as `$n::text`: `postgres` JSON-encodes any value bound to
 * a jsonb-typed parameter, so a pre-stringified value would be double-encoded
 * (stored as a JSON *string*). Binding as text and letting Postgres cast text →
 * jsonb behaves identically on every driver.
 */

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export class Frag {
  constructor(
    readonly strings: readonly string[],
    readonly values: readonly unknown[],
  ) {}
}

/** Compose a reusable SQL fragment. */
export function frag(strings: TemplateStringsArray, ...values: unknown[]): Frag {
  return new Frag(strings, values);
}

/** Inline trusted SQL text (never user input). */
export function raw(text: string): Frag {
  return new Frag([text], []);
}

/** Expand ids into `$1, $2, $3`. An empty list matches nothing. */
export function list(values: readonly unknown[]): Frag {
  if (values.length === 0) return raw("null");
  return new Frag(["", ...values.slice(1).map(() => ", "), ""], values);
}

function normalise(v: unknown): unknown {
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (v !== null && typeof v === "object") return JSON.stringify(v);
  return v;
}

export function compile(strings: readonly string[], values: readonly unknown[]) {
  const params: unknown[] = [];
  const build = (s: readonly string[], v: readonly unknown[]): string => {
    let text = s[0];
    for (let i = 0; i < v.length; i++) {
      const value = v[i];
      if (value instanceof Frag) {
        text += build(value.strings, value.values);
      } else {
        const v = normalise(value);
        params.push(v);
        text += `$${params.length}`;
        if (value !== null && typeof value === "object" && !(value instanceof Date)) text += "::text";
      }
      text += s[i + 1];
    }
    return text;
  };
  return { text: build(strings, values), params };
}

export type Sql = <T = Row>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T[]>;

const camelCache = new Map<string, string>();
function camel(key: string): string {
  let out = camelCache.get(key);
  if (out === undefined) {
    out = key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
    camelCache.set(key, out);
  }
  return out;
}

/** snake_case columns → camelCase properties (shallow: jsonb payloads are untouched). */
export function camelRows<T>(rows: readonly Row[]): T[] {
  return rows.map((row) => {
    const out: Row = {};
    for (const key of Object.keys(row)) out[camel(key)] = row[key];
    return out as T;
  });
}

/** Postgres error helpers used to turn constraint hits into friendly messages. */
export function pgCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) return String((err as { code: unknown }).code);
  return undefined;
}
export const isUniqueViolation = (e: unknown) => pgCode(e) === "23505";
export const isForeignKeyViolation = (e: unknown) => pgCode(e) === "23503";
