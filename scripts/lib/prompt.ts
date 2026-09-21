import readline from "node:readline/promises";
import { Writable } from "node:stream";
import type { Check } from "../../src/lib/setup-validate";

/**
 * Hidden-input prompts for the setup commands. EVERY prompt hides what you type or paste (not just the secret
 * ones), so a secret pasted at the wrong prompt is never shown on screen or kept in scrollback.
 */
export function createPrompter() {
  let muted = false;
  const out = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output: out, terminal: Boolean(process.stdin.isTTY) });

  async function ask(prompt: string): Promise<string> {
    process.stdout.write(prompt);
    muted = true;
    const answer = await rl.question("");
    muted = false;
    process.stdout.write("\n");
    return answer.trim();
  }

  /** Heuristic only: used to explain a wrong paste without showing it. */
  const looksLikeSecret = (v: string) => /^postgres(ql)?:\/\//.test(v) || /sb_(secret|publishable)_/.test(v) || /^eyJ[\w-]+\.[\w-]+\./.test(v);

  /** Keep asking until the value passes its check (5 tries). `transform` can adjust the raw answer first. */
  async function askChecked(
    prompt: string,
    check: (v: string) => Check,
    opts: { secret?: boolean; transform?: (raw: string) => Promise<string> } = {},
  ): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const raw0 = await ask(prompt);
      const raw = opts.transform ? await opts.transform(raw0) : raw0;
      const r = check(raw);
      if (r.ok) {
        if (r.warn) console.log(`  ⚠  ${r.warn}`);
        return r.value;
      }
      if (looksLikeSecret(raw0) && !opts.secret) console.log("  (that looks like a secret, and it was NOT shown. Make sure you paste each value at the right prompt.)");
      console.log(`  ✗ ${r.error}\n`);
    }
    console.log("\nToo many tries. Nothing was changed. Run the command again when you have the right value.");
    process.exit(1);
  }

  /** The connection string exactly as Supabase shows it: the [YOUR-PASSWORD] placeholder is filled in from a separate hidden prompt. */
  async function askDatabaseUrl(prompt: string, check: (v: string) => Check): Promise<string> {
    return askChecked(prompt, check, {
      secret: true,
      transform: async (raw) => {
        if (!/\[YOUR-PASSWORD\]/i.test(raw)) return raw;
        const pw = await ask("     Your database password (hidden): ");
        return raw.replace(/\[YOUR-PASSWORD\]/i, encodeURIComponent(pw));
      },
    });
  }

  return { ask, askChecked, askDatabaseUrl, close: () => rl.close() };
}
