// Turns the many ways banks write dates and amounts into one format.

import { roundMoney } from "@/lib/money";
import type { Direction } from "@/lib/types";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function iso(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return null; // e.g. 31 Feb
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Understands DD/MM/YYYY, DD-MM-YY, DD.MM.YYYY, YYYY-MM-DD, "25 Oct 2026",
// "25-Oct-26" and "25 October 2026". Singapore banks put the day first.
// For dates without a year ("25 Oct") pass fallbackYear.
export function parseDate(value: string, fallbackYear?: number): string | null {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return null;

  let m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));

  m = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?: .*)?$/);
  if (m) return iso(Number(m[3]), Number(m[2]), Number(m[1]));

  m = text.match(/^(\d{1,2})[ -]([A-Za-z]{3,9})[ ,-]*(\d{2}|\d{4})?$/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (!month) return null;
    const year = m[3] ? Number(m[3]) : fallbackYear;
    return year ? iso(year, month, Number(m[1])) : null;
  }

  m = text.match(/^([A-Za-z]{3,9}) (\d{1,2}),? (\d{4})$/);
  if (m) {
    const month = MONTHS[m[1].toLowerCase().slice(0, 3)];
    return month ? iso(Number(m[3]), month, Number(m[2])) : null;
  }

  return null;
}

export type ParsedAmount = {
  value: number; // always positive
  // What the text itself says: a minus sign or brackets, or a CR / DR marker.
  sign: "negative" | "positive";
  marker: Direction | null;
};

// Understands "1,234.50", "S$1,234.50", "-12.30", "(12.30)", "12.30 CR",
// "12.30DR" and "SGD 12.30". Returns null for blanks and non-numbers.
export function parseAmount(value: string | number | null | undefined): ParsedAmount | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { value: roundMoney(Math.abs(value)), sign: value < 0 ? "negative" : "positive", marker: null }
      : null;
  }
  let text = value.trim().toUpperCase();
  if (!text || text === "-") return null;

  let marker: Direction | null = null;
  const suffix = text.match(/\s*(CR|DR)\.?$/);
  if (suffix) {
    marker = suffix[1] === "CR" ? "credit" : "debit";
    text = text.slice(0, suffix.index).trim();
  }

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/^(SGD|S\$|\$)\s*/, "").replace(/\s*(SGD)$/, "");
  if (text.startsWith("-")) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.endsWith("-")) {
    negative = !negative;
    text = text.slice(0, -1);
  }
  text = text.replace(/^(SGD|S\$|\$)\s*/, "").replace(/[,\s]/g, "");
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(text)) return null;

  return { value: roundMoney(Number(text)), sign: negative ? "negative" : "positive", marker };
}

// Tidies a description: trims, collapses spaces.
export function cleanDescription(parts: (string | undefined)[]): string {
  return parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// Lines that aren't real transactions.
const NOT_A_TRANSACTION =
  /^(total|sub[- ]?total|balance b\/?f|balance c\/?f|balance brought forward|balance carried forward|brought forward|carried forward|opening balance|closing balance|previous balance|previous statement balance|new balance|statement balance|beginning balance|ending balance)\b/i;

export function isSummaryLine(description: string): boolean {
  return NOT_A_TRANSACTION.test(description.trim());
}
