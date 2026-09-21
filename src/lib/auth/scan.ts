/**
 * Pulls a login code out of whatever a QR scan returned. Browser-safe (no Node imports).
 *
 * The card QR is a link like https://app.example/l/KIM042, but we only ever take the CODE out of it
 * and sign in on OUR OWN origin, so a QR pointing anywhere else can never redirect a student off-site.
 * A bare code ("KIM-042") also works, e.g. a QR that just contains the code.
 */
export function codeFromScan(text: string): string | null {
  const t = text.trim();
  const fromLink = /\/l\/([A-Za-z0-9-]{4,16})(?:[/?#]|$)/.exec(t)?.[1];
  const raw = fromLink ?? (/^[A-Za-z0-9-]{4,16}$/.test(t) ? t : null);
  return raw ? raw.replace(/-/g, "").toUpperCase() : null;
}
