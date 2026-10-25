import { describe, expect, it } from "vitest";

import { descriptionSimilarity, findDuplicates, isLikelyDuplicate, normalizeForMatching } from "@/lib/duplicates";

const tx = (date: string, description: string, amount: number, direction: "debit" | "credit" = "debit") => ({
  date,
  description,
  amount,
  direction,
});

describe("duplicate detection", () => {
  it("ignores reference numbers and symbols", () => {
    expect(normalizeForMatching("GRAB*A-7XYZ123 SINGAPORE")).toBe("grab a singapore");
    expect(descriptionSimilarity("GRAB*A-7XYZ123 SINGAPORE", "Grab* A-8ABC999 Singapore")).toBe(1);
  });

  it("matches the same purchase written slightly differently", () => {
    expect(
      isLikelyDuplicate(tx("2026-10-01", "NTUC FP-BEDOK MALL", 12.4), tx("2026-10-01", "NTUC FP BEDOK MALL SINGAPORE", 12.4)),
    ).toBe(true);
  });

  it("needs the same date, amount and direction", () => {
    const a = tx("2026-10-01", "NTUC FAIRPRICE", 12.4);
    expect(isLikelyDuplicate(a, tx("2026-10-02", "NTUC FAIRPRICE", 12.4))).toBe(false);
    expect(isLikelyDuplicate(a, tx("2026-10-01", "NTUC FAIRPRICE", 12.41))).toBe(false);
    expect(isLikelyDuplicate(a, tx("2026-10-01", "NTUC FAIRPRICE", 12.4, "credit"))).toBe(false);
  });

  it("doesn't match different shops with the same amount", () => {
    expect(isLikelyDuplicate(tx("2026-10-01", "KOPITIAM TAMPINES", 5), tx("2026-10-01", "SHELL PETROL", 5))).toBe(false);
  });

  it("flags repeats of saved transactions and between files in one upload", () => {
    const saved = [tx("2026-10-01", "NTUC FAIRPRICE", 12.4)];
    const incoming = [
      { ...tx("2026-10-01", "NTUC FAIRPRICE", 12.4), source: "a.csv" }, // already saved
      { ...tx("2026-10-03", "TOAST BOX", 6.2), source: "a.csv" },
      { ...tx("2026-10-03", "TOAST BOX", 6.2), source: "b.csv" }, // overlapping file
      { ...tx("2026-10-04", "YA KUN", 4.5), source: "b.csv" },
    ];
    expect(findDuplicates(incoming, saved)).toEqual([saved[0], null, incoming[1], null]);
  });

  it("keeps identical purchases from the same file", () => {
    const incoming = [
      { ...tx("2026-10-01", "BUS/MRT", 1.5), source: "a.csv" },
      { ...tx("2026-10-01", "BUS/MRT", 1.5), source: "a.csv" },
    ];
    expect(findDuplicates(incoming, [])).toEqual([null, null]);
  });

  it("matches each saved transaction only once", () => {
    const saved = [tx("2026-10-01", "BUS/MRT", 1.5)];
    const incoming = [
      { ...tx("2026-10-01", "BUS/MRT", 1.5), source: "a.csv" },
      { ...tx("2026-10-01", "BUS/MRT", 1.5), source: "a.csv" },
    ];
    expect(findDuplicates(incoming, saved)).toEqual([saved[0], null]);
  });
});
