import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { parseCsv } from "@/lib/parsers/csv/parse";

const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, "fixtures/csv", name), "utf8");

// [file, bank, expected transactions as "date description amount direction"]
const CASES: [string, string, string[]][] = [
  [
    "dbs-account.csv",
    "DBS/POSB",
    [
      "2026-10-01 POS NTUC FP-BEDOK MALL SINGAPORE 12.4 debit",
      "2026-10-02 ICT SALARY ACME PTE LTD 3500 credit",
      "2026-10-03 MST KOPITIAM @ TAMPINES SINGAPORE SG 8.9 debit",
      "2026-10-05 ICT PAYNOW TRANSFER TO: MRS TAN OTHR 200 debit",
      "2026-10-06 UMC GRAB*A-7XYZ123 SINGAPORE 45.1 debit",
    ],
  ],
  [
    "dbs-card.csv",
    "DBS/POSB",
    [
      "2026-10-04 SHENG SIONG SUPERMARKET SINGAPORE 67.35 debit",
      "2026-10-07 FOODPANDA SINGAPORE 23.9 debit",
      "2026-10-12 PAYMENT - THANK YOU 500 credit",
    ],
  ],
  [
    "ocbc-account.csv",
    "OCBC",
    [
      "2026-10-01 DEBIT PURCHASE TOWN COUNCIL CONSERVANCY 1250 debit",
      "2026-10-03 FAST PAYMENT OTHR - REFUND FROM FRIEND 150 credit",
      "2026-10-08 NETS QR - YA KUN KAYA TOAST 5.6 debit",
    ],
  ],
  [
    "ocbc-card.csv",
    "OCBC",
    [
      "2026-10-02 COLD STORAGE - JELITA 88.2 debit",
      "2026-10-09 SP DIGITAL PTE LTD 132.45 debit",
      "2026-10-15 PAYMENT BY INTERNET 800 credit",
    ],
  ],
  [
    "uob-account.csv",
    "UOB",
    [
      "2026-10-02 NETS Purchase GIANT HYPERMARKET 54.3 debit",
      "2026-10-05 Inward Credit-FAST SALARY 4200 credit",
      "2026-10-10 Bill Payment SINGTEL 48.15 debit",
    ],
  ],
  [
    "uob-card.csv",
    "UOB",
    [
      "2026-10-03 DON DON DONKI ORCHARD 41.8 debit",
      "2026-10-06 AGODA.COM BANGKOK 120.55 debit",
      "2026-10-11 PAYMENT RECEIVED 300 credit",
    ],
  ],
  [
    "citibank-card.csv",
    "Citibank",
    [
      "2026-10-04 TOAST BOX - CHANGI 7.2 debit",
      "2026-10-09 NETFLIX.COM 19.98 debit",
      "2026-10-14 FAST INCOMING PAYMENT 650 credit",
    ],
  ],
  [
    "scb-card.csv",
    "Standard Chartered",
    [
      "2026-10-02 LAZADA SINGAPORE 35.5 debit",
      "2026-10-07 GUARDIAN HEALTH & BEAUTY 18.9 debit",
      "2026-10-18 PAYMENT VIA GIRO 1000 credit",
    ],
  ],
  [
    "hsbc-card.csv",
    "HSBC",
    [
      "2026-10-04 SHOPEE SINGAPORE MP 29.9 debit",
      "2026-10-09 SIMPLYGO BUS/MRT 3.45 debit",
      "2026-10-16 PAYMENT - THANK YOU 400 credit",
    ],
  ],
  [
    "trust-card.csv",
    "Trust Bank",
    [
      "2026-10-02 DELIVEROO SINGAPORE 31.2 debit",
      "2026-10-05 FAIRPRICE XTRA 102.75 debit",
      "2026-10-12 CASHBACK 4.1 credit",
    ],
  ],
];

describe("bank CSV parsers", () => {
  it.each(CASES)("reads %s", async (file, bank, expected) => {
    const statement = await parseCsv(fixture(file));
    expect(statement.bank).toBe(bank);
    expect(
      statement.transactions.map((t) => `${t.date} ${t.description} ${t.amount} ${t.direction}`),
    ).toEqual(expected);
    expect(statement.periodStart).toBe(expected[0].slice(0, 10));
    expect(statement.periodEnd).toBe(expected.at(-1)!.slice(0, 10));
  });

  it("guesses columns for an unknown bank with clear headers", async () => {
    const csv = "Date,Description,Amount\n01/10/2026,SHOP A,-10.00\n02/10/2026,SHOP B,-20.00\n03/10/2026,SALARY,100.00\n";
    const statement = await parseCsv(csv);
    expect(statement.bank).toBeNull();
    expect(statement.transactions.map((t) => t.direction)).toEqual(["debit", "debit", "credit"]);
  });

  it("asks for help when it can't tell the columns apart", async () => {
    const inferColumns = vi.fn().mockResolvedValue({ date: 0, description: [1], amount: 2, amountSign: "positive-is-debit" });
    const statement = await parseCsv(fixture("unknown-layout.csv"), { inferColumns });
    expect(inferColumns).toHaveBeenCalledWith(
      ["When", "What", "How much"],
      [
        ["01/10/2026", "MYSTERY SHOP", "10.00"],
        ["02/10/2026", "ANOTHER SHOP", "20.00"],
      ],
    );
    expect(statement.transactions).toHaveLength(2);
    expect(statement.transactions[0]).toEqual({ date: "2026-10-01", description: "MYSTERY SHOP", amount: 10, direction: "debit" });
  });

  it("explains when a file can't be read", async () => {
    await expect(parseCsv(fixture("unknown-layout.csv"))).rejects.toThrow(/couldn't work out the columns/);
    await expect(parseCsv("")).rejects.toThrow(/empty/);
  });
});
