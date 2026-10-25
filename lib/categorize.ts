import { findRule, type RuleLike } from "@/lib/merchant-rules";
import type { ParsedTransaction } from "@/lib/parsers/types";
import type { Category } from "@/lib/types";
import type { AiCategorization, AiCategory, AiTransaction } from "@/lib/ai-tasks";
import type { CategorizeResult } from "@/lib/upload/process";

export const BATCH_SIZE = 50;
export const REVIEW_BELOW = 0.7;
const PARALLEL_BATCHES = 4;

export type AiCategorizer = (transactions: AiTransaction[], categories: AiCategory[]) => Promise<AiCategorization[]>;

// Suggests a category for every transaction:
// 1. a saved merchant rule, if one matches the description;
// 2. otherwise Claude, in batches of about 50;
// 3. then rules again, using the clean merchant name Claude found.
// If Claude fails, those transactions are left for the person to pick.
export async function categorizeTransactions(
  transactions: ParsedTransaction[],
  categories: Category[],
  rules: RuleLike[],
  ai: AiCategorizer,
): Promise<{ results: CategorizeResult[]; aiFailed: boolean }> {
  const active = categories.filter((c) => c.is_active);
  const byName = new Map(active.map((c) => [c.name.toLowerCase(), c.id]));
  const results: CategorizeResult[] = transactions.map(() => ({
    categoryId: null,
    merchant: null,
    confidence: null,
    needsReview: true,
    categorizedBy: null,
  }));

  const fromRule = (rule: RuleLike, merchant: string | null): CategorizeResult => ({
    categoryId: rule.category_id,
    merchant,
    confidence: 1,
    needsReview: false,
    categorizedBy: "rule",
  });

  const forClaude: number[] = [];
  transactions.forEach((tx, i) => {
    const rule = findRule(tx, rules);
    if (rule) results[i] = fromRule(rule, null);
    else forClaude.push(i);
  });

  let aiFailed = false;
  if (forClaude.length > 0 && active.length > 0) {
    const batches: number[][] = [];
    for (let i = 0; i < forClaude.length; i += BATCH_SIZE) batches.push(forClaude.slice(i, i + BATCH_SIZE));
    const aiCategories = active.map((c) => ({ name: c.name, kind: c.kind, group: c.group_name }));

    for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
      await Promise.all(
        batches.slice(i, i + PARALLEL_BATCHES).map(async (batch) => {
          try {
            const answers = await ai(
              batch.map((index, n) => ({
                id: `t${n + 1}`,
                date: transactions[index].date,
                description: transactions[index].description,
                amount: transactions[index].amount,
                moneyIn: transactions[index].direction === "credit",
              })),
              aiCategories,
            );
            const byId = new Map(answers.map((a) => [a.id, a]));
            batch.forEach((index, n) => {
              const answer = byId.get(`t${n + 1}`);
              if (!answer) return;
              const merchant = answer.merchant.trim() || null;
              const rule = merchant ? findRule({ description: "", merchant }, rules) : null;
              if (rule) {
                results[index] = fromRule(rule, merchant);
                return;
              }
              const categoryId = byName.get(answer.category.toLowerCase()) ?? null;
              results[index] = {
                categoryId,
                merchant,
                confidence: Math.round(answer.confidence * 100) / 100,
                needsReview: categoryId === null || answer.confidence < REVIEW_BELOW,
                categorizedBy: categoryId ? "ai" : null,
              };
            });
          } catch (error) {
            console.error("Categorization batch failed", error);
            aiFailed = true;
          }
        }),
      );
    }
  }

  return { results, aiFailed };
}
