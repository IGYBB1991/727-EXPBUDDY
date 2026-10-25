// "This merchant always goes in this category." Rules are saved when one of
// us corrects a category, and applied to new transactions before asking
// Claude.

import { normalizeForMatching } from "@/lib/duplicates";

export type RuleLike = { merchant_pattern: string; category_id: string };

// The pattern saved for a transaction: its cleaned merchant name if we have
// one, otherwise its description without reference numbers.
export function patternFor(tx: { merchant: string | null; description: string }): string {
  const source = tx.merchant?.trim() || tx.description;
  return normalizeForMatching(source).slice(0, 100);
}

// The rule that fits a transaction best (the longest matching pattern).
// A rule matches when its words appear, in order, in the description or the
// merchant name.
export function findRule<R extends RuleLike>(
  tx: { description: string; merchant?: string | null },
  rules: R[],
): R | null {
  const haystacks = [tx.description, tx.merchant ?? ""]
    .map((t) => ` ${normalizeForMatching(t)} `)
    .filter((t) => t.trim());
  let best: R | null = null;
  for (const rule of rules) {
    const pattern = normalizeForMatching(rule.merchant_pattern);
    if (!pattern) continue;
    if (haystacks.some((h) => h.includes(` ${pattern} `))) {
      if (!best || pattern.length > normalizeForMatching(best.merchant_pattern).length) best = rule;
    }
  }
  return best;
}
