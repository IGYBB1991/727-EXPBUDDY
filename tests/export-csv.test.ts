import { describe, expect, it } from "vitest";

import { transactionsToCsv } from "@/lib/export-csv";
import type { Transaction } from "@/lib/types";

const base: Transaction = {
  id: "t1",
  date: "2026-10-03",
  description: "NTUC FAIRPRICE",
  merchant: "FairPrice",
  amount: 45.6,
  direction: "debit",
  category_id: "c1",
  owner_id: null,
  account_id: "a1",
  source_file: "dbs.csv",
  ai_confidence: 0.9,
  needs_review: false,
  notes: null,
  upload_id: null,
  split_parent_id: null,
  is_split: false,
  created_by: null,
  created_at: "2026-10-04T00:00:00Z",
};

const lookups = {
  categories: [{ id: "c1", name: "Groceries", group_name: "Food", color: "#000", kind: "expense" as const, is_active: true, sort_order: 1 }],
  accounts: [{ id: "a1", name: "DBS Multiplier", bank: "DBS", owner_id: null }],
  members: [],
};

describe("transactionsToCsv", () => {
  it("writes a header and readable rows", () => {
    const lines = transactionsToCsv([base, { ...base, id: "t2", direction: "credit", amount: 10, category_id: null }], lookups)
      .replace("﻿", "")
      .split("\r\n");
    expect(lines[0]).toBe(
      "Date,Description,Merchant,Amount (SGD),Direction,Category,Owner,Account,Notes,Needs review,Source file",
    );
    expect(lines[1]).toBe("2026-10-03,NTUC FAIRPRICE,FairPrice,45.60,Out,Groceries,Joint,DBS Multiplier,,No,dbs.csv");
    expect(lines[2]).toContain("-10.00,In,Uncategorized");
  });

  it("stops text from running as a spreadsheet formula", () => {
    const csv = transactionsToCsv([{ ...base, description: "=HYPERLINK(\"x\")", notes: "+65 call" }], lookups);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+65 call");
  });

  it("still has a header when there is nothing to export", () => {
    expect(transactionsToCsv([], lookups)).toContain("Date,Description");
  });
});
