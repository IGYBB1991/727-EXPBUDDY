// Spots transactions that are probably already saved, because bank
// statements often overlap (for example a mid-month download followed by
// the full month).

import type { Direction } from "@/lib/types";

type Comparable = { date: string; amount: number; direction: Direction; description: string };

// Lower case, without reference numbers, symbols or extra spaces, so
// "GRAB*A-7XYZ123 SINGAPORE" and "Grab* A-8ABC999 Singapore" look alike.
export function normalizeForMatching(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((word) => word && !/\d/.test(word))
    .join(" ");
}

function bigrams(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const compact = text.replace(/\s+/g, " ");
  for (let i = 0; i < compact.length - 1; i++) {
    const pair = compact.slice(i, i + 2);
    counts.set(pair, (counts.get(pair) ?? 0) + 1);
  }
  return counts;
}

// 0 (nothing alike) to 1 (the same), using shared pairs of letters.
export function descriptionSimilarity(a: string, b: string): number {
  const x = normalizeForMatching(a);
  const y = normalizeForMatching(b);
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const ax = bigrams(x);
  const by = bigrams(y);
  let shared = 0;
  for (const [pair, count] of ax) shared += Math.min(count, by.get(pair) ?? 0);
  return (2 * shared) / (x.length - 1 + (y.length - 1));
}

export const SIMILARITY_THRESHOLD = 0.6;

export function isLikelyDuplicate(a: Comparable, b: Comparable): boolean {
  return (
    a.date === b.date &&
    Math.round(a.amount * 100) === Math.round(b.amount * 100) &&
    a.direction === b.direction &&
    descriptionSimilarity(a.description, b.description) >= SIMILARITY_THRESHOLD
  );
}

// For each new transaction, the transaction it probably repeats, if any:
// either one already saved, or one from another file in the same upload
// (overlapping statements uploaded together). Rows from the same file never
// match each other, because two identical bus rides on one day are real.
// Each earlier transaction can be matched only once.
export function findDuplicates<N extends Comparable & { source: string }, E extends Comparable>(
  incoming: N[],
  existing: E[],
): (E | N | null)[] {
  const usedExisting = new Set<number>();
  const usedIncoming = new Set<number>();
  return incoming.map((tx, index) => {
    const saved = existing.findIndex((e, i) => !usedExisting.has(i) && isLikelyDuplicate(tx, e));
    if (saved >= 0) {
      usedExisting.add(saved);
      return existing[saved];
    }
    const earlier = incoming.findIndex(
      (e, i) => i < index && !usedIncoming.has(i) && e.source !== tx.source && isLikelyDuplicate(tx, e),
    );
    if (earlier >= 0) {
      usedIncoming.add(earlier);
      return incoming[earlier];
    }
    return null;
  });
}
