import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { processUploads } from "@/lib/upload/process";
import { fakeSupabase } from "./fake-supabase";

const file = (name: string, text: string) => ({
  name,
  type: name.endsWith(".csv") ? "text/csv" : "application/pdf",
  bytes: new TextEncoder().encode(text).buffer as ArrayBuffer,
});

const CSV_A = "Date,Description,Amount\n01/10/2026,NTUC FAIRPRICE,12.40\n03/10/2026,TOAST BOX,6.20\n";
const CSV_B = "Date,Description,Amount\n03/10/2026,TOAST BOX,6.20\n04/10/2026,YA KUN,4.50\n";

describe("processUploads", () => {
  it("reads files and flags duplicates against saved and other files", async () => {
    const supabase = fakeSupabase({
      transactions: [{ date: "2026-10-01", description: "NTUC FAIRPRICE SINGAPORE", amount: "12.40", direction: "debit" }],
    });
    const [a, b] = await processUploads(supabase, [file("a.csv", CSV_A), file("b.csv", CSV_B)]);

    expect(a.error).toBeNull();
    expect(a.transactions.map((t) => t.duplicateOf?.alreadySaved ?? null)).toEqual([true, null]);
    expect(b.transactions.map((t) => t.duplicateOf?.alreadySaved ?? null)).toEqual([false, null]);
    expect(b.periodStart).toBe("2026-10-03");
    // Without Claude everything waits for a category.
    expect(a.transactions[1]).toMatchObject({ categoryId: null, needsReview: true });
  });

  it("reports a problem with one file without losing the others", async () => {
    const results = await processUploads(fakeSupabase({}), [
      file("bad.csv", "hello,world\n1,2\n"),
      file("statement.pdf", "%PDF-1.4"),
      file("good.csv", CSV_A),
    ]);
    expect(results[0].error).toMatch(/couldn't work out the columns/);
    expect(results[1].error).toMatch(/PDF statements aren't supported yet/);
    expect(results[2].transactions).toHaveLength(2);
  });

  it("uses the categorizer when one is given", async () => {
    const categorize = vi.fn(async (txs: unknown[]) =>
      txs.map(() => ({ categoryId: "c1", merchant: "FairPrice", confidence: 0.95, needsReview: false, categorizedBy: "ai" as const })),
    );
    const [a] = await processUploads(fakeSupabase({}), [file("a.csv", CSV_A)], { categorize });
    expect(categorize).toHaveBeenCalledOnce();
    expect(a.transactions[0]).toMatchObject({ categoryId: "c1", merchant: "FairPrice", needsReview: false });
  });
});
