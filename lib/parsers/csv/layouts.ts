// Known CSV layouts from Singapore banks. Each one names the exact headers
// the bank uses, so we can tell which bank a file came from and read it
// reliably. To support another bank, add an entry here (and a sample file
// in tests/fixtures/csv).

import { guessColumns, normalizeHeader, type ColumnMap } from "./columns";

export type BankLayout = {
  bank: string;
  // Every one of these headers must appear (in any order, any case).
  headers: string[];
  // Adjust the guessed columns when the bank does something unusual.
  amountSign?: ColumnMap["amountSign"];
  description?: string[]; // header names to join for the description, in order
};

export const LAYOUTS: BankLayout[] = [
  {
    bank: "DBS/POSB",
    headers: ["transaction date", "reference", "debit amount", "credit amount", "transaction ref1"],
    description: ["reference", "transaction ref1", "transaction ref2", "transaction ref3"],
  },
  {
    bank: "DBS/POSB",
    headers: ["transaction date", "transaction description", "transaction amount (sgd)", "transaction type"],
  },
  {
    bank: "OCBC",
    headers: ["transaction date", "value date", "description", "withdrawals (sgd)", "deposits (sgd)"],
  },
  {
    bank: "OCBC",
    headers: ["transaction date", "description", "withdrawals (sgd)", "deposits (sgd)"],
  },
  {
    bank: "UOB",
    headers: ["transaction date", "transaction description", "withdrawal", "deposit", "available balance"],
  },
  {
    bank: "UOB",
    headers: ["transaction date", "posting date", "description", "transaction amount(local)"],
    amountSign: "positive-is-debit",
  },
  {
    bank: "Citibank",
    headers: ["transaction date", "transaction details", "amount (sgd)"],
    amountSign: "positive-is-debit",
  },
  {
    bank: "Standard Chartered",
    headers: ["date", "transaction", "amount (sgd)"],
    amountSign: "positive-is-debit",
  },
  {
    bank: "HSBC",
    headers: ["post date", "trans date", "description", "billing amount"],
    amountSign: "positive-is-debit",
  },
  {
    bank: "Trust Bank",
    headers: ["transaction date", "merchant", "amount", "debit/credit", "currency"],
  },
];

export function matchLayout(headerRow: string[]): { bank: string; columns: ColumnMap } | null {
  const headers = headerRow.map(normalizeHeader);
  for (const layout of LAYOUTS) {
    if (!layout.headers.every((h) => headers.includes(h))) continue;
    const columns = guessColumns(headerRow);
    if (!columns) continue;
    if (layout.amountSign && columns.amount !== undefined) columns.amountSign = layout.amountSign;
    if (layout.description) {
      columns.description = layout.description.map((h) => headers.indexOf(h)).filter((i) => i >= 0);
    }
    if (layout.bank === "HSBC") columns.date = headers.indexOf("trans date");
    return { bank: layout.bank, columns };
  }
  return null;
}
