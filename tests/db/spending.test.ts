import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { TEST_DATABASE_URL, asUser, freshDatabase } from "./helpers";

const MEMBER = "33333333-3333-3333-3333-333333333333";

describe.skipIf(!TEST_DATABASE_URL)("monthly_spending", () => {
  let db: Client;

  beforeAll(async () => {
    db = await freshDatabase();
    await db.query(`insert into auth.users (id, email) values ($1, 'm@example.com')`, [MEMBER]);
    await db.query(
      `insert into public.members (user_id, email, display_name) values ($1, 'm@example.com', 'M')`,
      [MEMBER],
    );
    const cat = async (name: string) =>
      (await db.query("select id from public.categories where name = $1", [name])).rows[0].id;
    const groceries = await cat("Groceries");
    const transfers = await cat("Transfers");
    const insert = (date: string, amount: number, direction: string, category: string | null, extra = "") =>
      db.query(
        `insert into public.transactions (date, description, amount, direction, category_id${extra ? ", is_split" : ""})
         values ($1, 'x', $2, $3, $4${extra ? ", true" : ""})`,
        [date, amount, direction, category],
      );
    await insert("2026-10-01", 100, "debit", groceries);
    await insert("2026-10-15", 20.5, "credit", groceries); // refund
    await insert("2026-10-20", 500, "debit", transfers); // not spending
    await insert("2026-10-21", 999, "debit", groceries, "split"); // split original
    await insert("2026-10-22", 7, "debit", null); // uncategorized
    await insert("2026-11-01", 50, "debit", groceries);
  });

  afterAll(async () => {
    await db?.end();
  });

  it("adds up spending per month and category", async () => {
    const rows = await asUser(db, MEMBER, async () =>
      (
        await db.query(
          `select s.month, c.name, s.total::float as total
           from public.monthly_spending('2026-10-01', '2026-11-30') s
           left join public.categories c on c.id = s.category_id
           order by s.month, c.name`,
        )
      ).rows,
    );
    expect(rows).toEqual([
      { month: "2026-10", name: "Groceries", total: 79.5 },
      { month: "2026-10", name: null, total: 7 },
      { month: "2026-11", name: "Groceries", total: 50 },
    ]);
  });
});

describe.skipIf(!TEST_DATABASE_URL)("merchant_spending", () => {
  let db: Client;

  beforeAll(async () => {
    db = await freshDatabase();
    await db.query(`insert into auth.users (id, email) values ($1, 'm@example.com')`, [MEMBER]);
    await db.query(
      `insert into public.members (user_id, email, display_name) values ($1, 'm@example.com', 'M')`,
      [MEMBER],
    );
    await db.query(`
      insert into public.transactions (date, description, merchant, amount, direction) values
        ('2026-10-01', 'NTUC FP 1', 'NTUC FairPrice', 10, 'debit'),
        ('2026-10-02', 'NTUC FP 2', 'NTUC FairPrice', 15, 'debit'),
        ('2026-10-03', 'MYSTERY SHOP', null, 5, 'debit')`);
  });

  afterAll(async () => {
    await db?.end();
  });

  it("adds up by merchant, falling back to the description", async () => {
    const rows = await asUser(db, MEMBER, async () =>
      (
        await db.query(
          `select merchant, total::float as total, transaction_count::int as n
           from public.merchant_spending('2026-10-01', '2026-10-31') order by total desc`,
        )
      ).rows,
    );
    expect(rows).toEqual([
      { merchant: "NTUC FairPrice", total: 25, n: 2 },
      { merchant: "MYSTERY SHOP", total: 5, n: 1 },
    ]);
  });
});
