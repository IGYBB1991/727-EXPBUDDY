import { describe, expect, it, vi } from "vitest";

import { categorizeTransactions, type AiCategorizer } from "@/lib/categorize";
import type { Category } from "@/lib/types";

const cat = (id: string, name: string, is_active = true): Category => ({
  id,
  name,
  group_name: null,
  color: "#000000",
  kind: "expense",
  is_active,
  sort_order: 0,
});
const categories = [cat("g", "Groceries"), cat("d", "Dining out"), cat("t", "Transport"), cat("x", "Old", false)];
const tx = (description: string, amount = 10, direction: "debit" | "credit" = "debit") => ({
  date: "2026-10-01",
  description,
  amount,
  direction,
});

describe("categorizeTransactions", () => {
  it("uses merchant rules first and sends only the rest to Claude", async () => {
    const ai = vi.fn<AiCategorizer>(async (txs) =>
      txs.map((t) => ({ id: t.id, merchant: "Toast Box", category: "Dining out", confidence: 0.9 })),
    );
    const { results } = await categorizeTransactions(
      [tx("NTUC FP BEDOK"), tx("TOAST BOX CHANGI")],
      categories,
      [{ merchant_pattern: "ntuc", category_id: "g" }],
      ai,
    );
    expect(ai).toHaveBeenCalledOnce();
    expect(ai.mock.calls[0][0]).toEqual([
      { id: "t1", date: "2026-10-01", description: "TOAST BOX CHANGI", amount: 10, moneyIn: false },
    ]);
    // Hidden categories aren't offered.
    expect(ai.mock.calls[0][1].map((c) => c.name)).toEqual(["Groceries", "Dining out", "Transport"]);
    expect(results).toEqual([
      { categoryId: "g", merchant: null, confidence: 1, needsReview: false, categorizedBy: "rule" },
      { categoryId: "d", merchant: "Toast Box", confidence: 0.9, needsReview: false, categorizedBy: "ai" },
    ]);
  });

  it("flags low confidence and unknown categories for review", async () => {
    const ai: AiCategorizer = async (txs) => [
      { id: txs[0].id, merchant: "Grab", category: "Transport", confidence: 0.5 },
      { id: txs[1].id, merchant: "Mystery", category: "Not a category", confidence: 0.9 },
    ];
    const { results } = await categorizeTransactions([tx("GRAB*123"), tx("???")], categories, [], ai);
    expect(results[0]).toMatchObject({ categoryId: "t", needsReview: true, confidence: 0.5 });
    expect(results[1]).toMatchObject({ categoryId: null, needsReview: true });
  });

  it("applies rules to the merchant name Claude found", async () => {
    const ai: AiCategorizer = async (txs) => [{ id: txs[0].id, merchant: "NTUC FairPrice", category: "Dining out", confidence: 0.8 }];
    const { results } = await categorizeTransactions(
      [tx("FP XTRA 0012")],
      categories,
      [{ merchant_pattern: "ntuc fairprice", category_id: "g" }],
      ai,
    );
    expect(results[0]).toMatchObject({ categoryId: "g", merchant: "NTUC FairPrice", categorizedBy: "rule" });
  });

  it("sends batches of 50", async () => {
    const ai = vi.fn<AiCategorizer>(async (txs) =>
      txs.map((t) => ({ id: t.id, merchant: "Shop", category: "Groceries", confidence: 0.95 })),
    );
    const many = Array.from({ length: 120 }, (_, i) => tx(`SHOP ${i}`));
    const { results } = await categorizeTransactions(many, categories, [], ai);
    expect(ai.mock.calls.map((c) => c[0].length)).toEqual([50, 50, 20]);
    expect(results.every((r) => r.categoryId === "g")).toBe(true);
  });

  it("keeps going when Claude fails", async () => {
    const ai: AiCategorizer = async () => {
      throw new Error("down");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { results, aiFailed } = await categorizeTransactions([tx("SHOP")], categories, [], ai);
    expect(aiFailed).toBe(true);
    expect(results[0]).toMatchObject({ categoryId: null, needsReview: true });
  });
});
