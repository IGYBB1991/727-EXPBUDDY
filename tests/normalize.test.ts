import { describe, expect, it } from "vitest";

import { isSummaryLine, parseAmount, parseDate } from "@/lib/parsers/normalize";

describe("parseDate", () => {
  it.each([
    ["25/10/2026", "2026-10-25"],
    ["5/1/26", "2026-01-05"],
    ["25-10-2026", "2026-10-25"],
    ["25.10.2026", "2026-10-25"],
    ["2026-10-25", "2026-10-25"],
    ["25 Oct 2026", "2026-10-25"],
    ["25 OCT 26", "2026-10-25"],
    ["25-Oct-2026", "2026-10-25"],
    ["25 October 2026", "2026-10-25"],
    ["1 Sept 2026", "2026-09-01"],
    ["Oct 25, 2026", "2026-10-25"],
  ])("reads %s", (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it("uses the fallback year for dates without one", () => {
    expect(parseDate("25 Oct", 2026)).toBe("2026-10-25");
    expect(parseDate("25 Oct")).toBeNull();
  });

  it("rejects impossible dates and non-dates", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("13/13/2026")).toBeNull();
    expect(parseDate("Opening balance")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("parseAmount", () => {
  it("reads commas, currency signs and CR/DR markers", () => {
    expect(parseAmount("1,234.50")).toEqual({ value: 1234.5, sign: "positive", marker: null });
    expect(parseAmount("S$12.30")).toEqual({ value: 12.3, sign: "positive", marker: null });
    expect(parseAmount("SGD 7")).toEqual({ value: 7, sign: "positive", marker: null });
    expect(parseAmount("-12.30")).toEqual({ value: 12.3, sign: "negative", marker: null });
    expect(parseAmount("(650.00)")).toEqual({ value: 650, sign: "negative", marker: null });
    expect(parseAmount("1,000.00 CR")).toEqual({ value: 1000, sign: "positive", marker: "credit" });
    expect(parseAmount("45.10DR")).toEqual({ value: 45.1, sign: "positive", marker: "debit" });
    expect(parseAmount("12.30-")).toEqual({ value: 12.3, sign: "negative", marker: null });
  });

  it("returns null for blanks and words", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("-")).toBeNull();
    expect(parseAmount("n/a")).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
  });
});

describe("isSummaryLine", () => {
  it("spots balances and totals", () => {
    for (const line of ["Opening Balance", "BALANCE B/F", "Previous balance", "Total", "Sub-total", "Closing balance"]) {
      expect(isSummaryLine(line)).toBe(true);
    }
    expect(isSummaryLine("NTUC FAIRPRICE")).toBe(false);
  });
});
