import { describe, expect, it } from "vitest";

import { checkPdf, cleanPdfExtraction } from "@/lib/parsers/pdf";

const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe("PDF checks", () => {
  it("accepts a normal PDF", () => {
    expect(() => checkPdf(bytes("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>"))).not.toThrow();
  });

  it("rejects password-protected PDFs with a clear message", () => {
    expect(() => checkPdf(bytes("%PDF-1.7\ntrailer << /Root 1 0 R /Encrypt 5 0 R >>"))).toThrow(/password-protected/);
  });

  it("rejects files that aren't PDFs", () => {
    expect(() => checkPdf(bytes("hello"))).toThrow(/isn't a valid PDF/);
  });
});

describe("cleaning Claude's PDF answer", () => {
  it("normalizes dates and amounts and drops balance lines", () => {
    const statement = cleanPdfExtraction({
      bank: "UOB",
      period_start: "2026-10-01",
      period_end: "2026-10-31",
      transactions: [
        { date: "2026-10-01", description: "PREVIOUS BALANCE", amount: 500, direction: "debit" },
        { date: "03 OCT", description: "  DON DON DONKI   ORCHARD ", amount: 41.799999, direction: "debit" },
        { date: "2026-10-11", description: "PAYMENT RECEIVED", amount: -300, direction: "credit" },
        { date: "not a date", description: "???", amount: 1, direction: "debit" },
      ],
    });
    expect(statement).toEqual({
      bank: "UOB",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      transactions: [
        { date: "2026-10-03", description: "DON DON DONKI ORCHARD", amount: 41.8, direction: "debit" },
        { date: "2026-10-11", description: "PAYMENT RECEIVED", amount: 300, direction: "credit" },
      ],
    });
  });

  it("explains when nothing was found", () => {
    expect(() => cleanPdfExtraction({ bank: null, period_start: null, period_end: null, transactions: [] })).toThrow(
      /couldn't find any transactions/,
    );
  });
});
