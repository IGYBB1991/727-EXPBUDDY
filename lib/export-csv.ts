import Papa from "papaparse";

import type { Account, Category, Member, Transaction } from "@/lib/types";

const COLUMNS = [
  "Date",
  "Description",
  "Merchant",
  "Amount (SGD)",
  "Direction",
  "Category",
  "Owner",
  "Account",
  "Notes",
  "Needs review",
  "Source file",
];

// Spreadsheet apps run cells starting with these characters as formulas, so
// a description like "=HYPERLINK(...)" could do something nasty when opened.
const FORMULA_START = /^[=+\-@\t\r]/;

function safeText(value: string | null) {
  if (!value) return "";
  return FORMULA_START.test(value) ? `'${value}` : value;
}

export function transactionsToCsv(
  transactions: Transaction[],
  lookups: { categories: Category[]; accounts: Account[]; members: Member[] },
) {
  const categoryName = new Map(lookups.categories.map((c) => [c.id, c.name]));
  const accountName = new Map(lookups.accounts.map((a) => [a.id, a.name]));
  const memberName = new Map(lookups.members.map((m) => [m.id, m.display_name]));
  const data = transactions.map((t) => [
    t.date,
    safeText(t.description),
    safeText(t.merchant),
    // Money out is positive, money in is negative, like on the dashboard.
    (t.direction === "debit" ? t.amount : -t.amount).toFixed(2),
    t.direction === "debit" ? "Out" : "In",
    safeText(t.category_id ? (categoryName.get(t.category_id) ?? "") : "Uncategorized"),
    safeText(t.owner_id ? (memberName.get(t.owner_id) ?? "") : "Joint"),
    safeText(t.account_id ? (accountName.get(t.account_id) ?? "") : ""),
    safeText(t.notes),
    t.needs_review ? "Yes" : "No",
    safeText(t.source_file),
  ]);
  // The byte order mark helps Excel read the file as UTF-8.
  return "﻿" + Papa.unparse({ fields: COLUMNS, data });
}
