import { randomInt } from "node:crypto";

/** No 0/O/1/I/L: codes are read off a card and typed on a phone. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateLoginCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** "kim-042", " KIM 042 " → "KIM042" */
export function normaliseCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** KIM042 → KIM-042 */
export function displayCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

export const studentTag = (no: number) => `KAC-${String(no).padStart(3, "0")}`;
