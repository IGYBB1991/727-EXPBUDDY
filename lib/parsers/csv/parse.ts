import Papa from "papaparse";

import { roundMoney } from "@/lib/money";
import type { Direction } from "@/lib/types";
import { cleanDescription, isSummaryLine, parseAmount, parseDate } from "../normalize";
import { StatementError, type ParsedStatement, type ParsedTransaction } from "../types";
import { guessColumns, looksLikeHeader, type ColumnMap } from "./columns";
import { matchLayout } from "./layouts";

// Asks someone else (Claude) which column is which when the layout isn't
// recognized. Gets the header row and a few sample rows.
export type ColumnInferrer = (header: string[], samples: string[][]) => Promise<ColumnMap | null>;

export function readCsvRows(text: string): string[][] {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  return result.data.map((row) => row.map((cell) => (cell ?? "").toString()));
}

function findHeaderRow(rows: string[][]): number {
  return rows.slice(0, 40).findIndex(looksLikeHeader);
}

// A year mentioned near the top of the file, for dates written without one.
function yearHint(rows: string[][]): number | undefined {
  for (const row of rows.slice(0, 20)) {
    const m = row.join(" ").match(/\b(20\d{2})\b/);
    if (m) return Number(m[1]);
  }
  return undefined;
}

function typeToDirection(value: string): Direction | null {
  const v = value.trim().toLowerCase();
  if (/^(debit|dr|withdrawal|purchase|payment out|out)$/.test(v)) return "debit";
  if (/^(credit|cr|deposit|refund|in)$/.test(v)) return "credit";
  return null;
}

type Draft = ParsedTransaction & { signedText?: "negative" | "positive"; marker?: Direction | null };

export async function parseCsv(
  text: string,
  opts: { inferColumns?: ColumnInferrer; now?: Date } = {},
): Promise<ParsedStatement> {
  const rows = readCsvRows(text);
  if (rows.length === 0) throw new StatementError("This file is empty.");

  const headerIndex = findHeaderRow(rows);
  let bank: string | null = null;
  let columns: ColumnMap | null = null;
  let dataStart = headerIndex + 1;

  if (headerIndex >= 0) {
    const known = matchLayout(rows[headerIndex]);
    if (known) {
      bank = known.bank;
      columns = known.columns;
    } else {
      columns = guessColumns(rows[headerIndex]);
    }
  }

  if (!columns && opts.inferColumns) {
    // Use the first row as a header if it doesn't look like data.
    const firstDataRow = rows.findIndex((r) => r.some((c) => parseDate(c)));
    const header = headerIndex >= 0 ? rows[headerIndex] : firstDataRow > 0 ? rows[firstDataRow - 1] : [];
    const start = headerIndex >= 0 ? headerIndex + 1 : Math.max(firstDataRow, 0);
    columns = await opts.inferColumns(header, rows.slice(start, start + 8));
    dataStart = start;
  }

  if (!columns) {
    throw new StatementError(
      "We couldn't work out the columns in this CSV. Check it's a transaction export from your bank.",
    );
  }

  const fallbackYear = yearHint(rows) ?? (opts.now ?? new Date()).getFullYear();
  const drafts: Draft[] = [];

  for (const row of rows.slice(dataStart)) {
    const description = cleanDescription(columns.description.map((i) => row[i]));
    const date = parseDate(row[columns.date] ?? "", fallbackYear);

    if (!date) {
      // Some banks (like OCBC) carry long descriptions onto the next line.
      const hasMoney =
        [columns.amount, columns.debit, columns.credit].some((i) => i !== undefined && parseAmount(row[i]));
      const last = drafts.at(-1);
      if (last && description && !hasMoney && !(row[columns.date] ?? "").trim()) {
        last.description = cleanDescription([last.description, description]);
      }
      continue;
    }
    if (!description || isSummaryLine(description)) continue;

    let draft: Draft | null = null;
    if (columns.debit !== undefined || columns.credit !== undefined) {
      const debit = columns.debit !== undefined ? parseAmount(row[columns.debit]) : null;
      const credit = columns.credit !== undefined ? parseAmount(row[columns.credit]) : null;
      if (debit && debit.value > 0) draft = { date, description, amount: debit.value, direction: "debit" };
      else if (credit && credit.value > 0) draft = { date, description, amount: credit.value, direction: "credit" };
    } else if (columns.amount !== undefined) {
      const amount = parseAmount(row[columns.amount]);
      if (amount && amount.value > 0) {
        const typed = columns.type !== undefined ? typeToDirection(row[columns.type] ?? "") : null;
        draft = {
          date,
          description,
          amount: amount.value,
          direction: typed ?? amount.marker ?? "debit",
          signedText: typed || amount.marker ? undefined : amount.sign,
          marker: typed ?? amount.marker,
        };
      }
    }
    if (draft) drafts.push(draft);
  }

  // A single amount column without markers: decide which sign is money out.
  if (columns.amount !== undefined) {
    let sign = columns.amountSign ?? "auto";
    if (sign === "auto") {
      const unmarked = drafts.filter((d) => d.signedText);
      const negatives = unmarked.filter((d) => d.signedText === "negative").length;
      const hasCrMarkers = drafts.some((d) => d.marker === "credit");
      // Bank accounts usually show spending as negative; card statements
      // show spending as positive and payments as negative or "CR".
      sign = !hasCrMarkers && negatives > unmarked.length / 2 ? "negative-is-debit" : "positive-is-debit";
    }
    for (const d of drafts) {
      if (!d.signedText) continue;
      const negative = d.signedText === "negative";
      d.direction = (sign === "negative-is-debit") === negative ? "debit" : "credit";
    }
  }

  const transactions: ParsedTransaction[] = drafts.map(({ date, description, amount, direction }) => ({
    date,
    description,
    amount: roundMoney(amount),
    direction,
  }));
  if (transactions.length === 0) {
    throw new StatementError("We didn't find any transactions in this file.");
  }

  const dates = transactions.map((t) => t.date).sort();
  return { bank, periodStart: dates[0], periodEnd: dates.at(-1)!, transactions };
}
