// Works out which column of a bank's CSV holds what.

export type ColumnMap = {
  date: number;
  description: number[]; // joined together, in order
  amount?: number; // one column for money in and out
  debit?: number; // money out
  credit?: number; // money in
  type?: number; // a column that says "Debit"/"Credit" or "DR"/"CR"
  // With a single amount column and no CR/DR markers, which sign means money
  // out. "auto" decides from the file itself.
  amountSign?: "negative-is-debit" | "positive-is-debit" | "auto";
};

export function normalizeHeader(header: string): string {
  return header.replace(/^﻿/, "").trim().toLowerCase().replace(/\s+/g, " ");
}

const DATE = /^(transaction date|trans(\.|action)? date|txn date|date|date of transaction|transaction posted date|posting date|post date|value date)$/;
const PREFERRED_DATE = /^(transaction date|trans(\.|action)? date|txn date|date|date of transaction)$/;
const DESCRIPTION =
  /(description|details|particulars|narrative|merchant|remarks|^transaction$|^reference$|transaction ref|^payee|^memo)/;
const DEBIT = /(withdrawal|debit amount|^debit$|money out|paid out|^debits?\b|^spent)/;
const CREDIT = /(deposit|credit amount|^credit$|money in|paid in|^credits?\b|^received)/;
const AMOUNT = /(^amount|transaction amount ?\(local\)|^sgd amount|billing amount|amount \(sgd\)|^value$)/;
const TYPE = /^(type|transaction type|dr\/cr|cr\/dr|debit\/credit|credit\/debit)$/;
const IGNORE = /(balance|foreign|currency|category|status|card no|card number|account no)/;

export function looksLikeHeader(row: string[]): boolean {
  const cells = row.map(normalizeHeader);
  const hasDate = cells.some((c) => DATE.test(c));
  const hasMoney = cells.some((c) => !IGNORE.test(c) && (DEBIT.test(c) || CREDIT.test(c) || AMOUNT.test(c)));
  return hasDate && hasMoney;
}

// Guesses the columns from header names. Returns null if it can't find a
// date, a description and some kind of amount.
export function guessColumns(headerRow: string[]): ColumnMap | null {
  const headers = headerRow.map(normalizeHeader);
  const find = (re: RegExp, skip: Set<number> = new Set()) =>
    headers.findIndex((h, i) => !skip.has(i) && re.test(h) && !IGNORE.test(h));

  let date = find(PREFERRED_DATE);
  if (date < 0) date = find(DATE);
  if (date < 0) return null;

  const used = new Set([date]);
  const type = find(TYPE, used);
  if (type >= 0) used.add(type);
  const debit = find(DEBIT, used);
  if (debit >= 0) used.add(debit);
  const credit = find(CREDIT, used);
  if (credit >= 0) used.add(credit);
  let amount = -1;
  if (debit < 0 && credit < 0) {
    // Prefer the local (SGD) amount when there's a foreign one too.
    amount = find(AMOUNT, used);
    if (amount >= 0) used.add(amount);
  }
  if (debit < 0 && credit < 0 && amount < 0) return null;

  const description = headers
    .map((h, i) => (!used.has(i) && !DATE.test(h) && DESCRIPTION.test(h) && !IGNORE.test(h) ? i : -1))
    .filter((i) => i >= 0);
  if (description.length === 0) return null;

  return {
    date,
    description,
    ...(amount >= 0 ? { amount, amountSign: "auto" as const } : {}),
    ...(debit >= 0 ? { debit } : {}),
    ...(credit >= 0 ? { credit } : {}),
    ...(type >= 0 ? { type } : {}),
  };
}
