import { roundMoney } from "@/lib/money";
import { isSummaryLine, parseDate } from "./normalize";
import { StatementError, type ParsedStatement, type ParsedTransaction } from "./types";

// What Claude reads out of a PDF statement (see lib/ai-tasks.ts).
export type PdfExtraction = {
  bank: string | null;
  period_start: string | null;
  period_end: string | null;
  transactions: { date: string; description: string; amount: number; direction: "debit" | "credit" }[];
};

const MAX_PDF_BYTES = 30 * 1024 * 1024;

// Checks the file is a PDF we can send: a real PDF, not too big, and not
// password-protected.
export function checkPdf(bytes: ArrayBuffer): void {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 1024));
  if (!head.includes("%PDF-")) throw new StatementError("This file isn't a valid PDF.");
  if (bytes.byteLength > MAX_PDF_BYTES) throw new StatementError("This PDF is too large.");
  // Encrypted PDFs carry an /Encrypt entry. Look at the whole file because it
  // can sit at the end (in the trailer) or the start (linearized files).
  const text = new TextDecoder("latin1").decode(bytes);
  if (/\/Encrypt\s/.test(text) || /\/Encrypt\s*\d+\s+\d+\s+R/.test(text)) {
    throw new StatementError(
      "This PDF is password-protected. Open it, save a copy without the password (or print it to PDF), and upload that.",
    );
  }
}

// Turns Claude's answer into clean transactions, double-checking every
// date and amount and dropping balance and total lines.
export function cleanPdfExtraction(extraction: PdfExtraction): ParsedStatement {
  const transactions: ParsedTransaction[] = [];
  const year = extraction.period_end ? Number(extraction.period_end.slice(0, 4)) : undefined;
  for (const t of extraction.transactions) {
    const date = parseDate(t.date, year);
    const description = t.description.replace(/\s+/g, " ").trim();
    const amount = roundMoney(Math.abs(t.amount));
    if (!date || !description || !(amount > 0) || isSummaryLine(description)) continue;
    transactions.push({ date, description, amount, direction: t.direction === "credit" ? "credit" : "debit" });
  }
  if (transactions.length === 0) {
    throw new StatementError("We couldn't find any transactions in this PDF. Is it a bank or card statement?");
  }
  const dates = transactions.map((t) => t.date).sort();
  return {
    bank: extraction.bank?.trim() || null,
    periodStart: (extraction.period_start && parseDate(extraction.period_start)) || dates[0],
    periodEnd: (extraction.period_end && parseDate(extraction.period_end)) || dates.at(-1)!,
    transactions,
  };
}
