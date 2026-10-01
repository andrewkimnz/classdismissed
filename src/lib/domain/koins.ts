import type { KoinTransactionRow, World } from "@/lib/types";

/** A member's own transactions, most recent first — what the Wallet page shows. */
export const koinHistory = (w: World, studentId: number): KoinTransactionRow[] =>
  w.koinTransactions.filter((t) => t.studentId === studentId).sort((a, b) => b.id - a.id);

/** Sum of every active transaction. Never stored — always derived, so nothing can drift out of sync. */
export function koinBalance(w: World, studentId: number): number {
  return w.koinTransactions.filter((t) => t.studentId === studentId).reduce((n, t) => n + t.delta, 0);
}
