import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { TEST_DATABASE_URL, asUser, freshDatabase } from "./helpers";

const MEMBER = "11111111-1111-1111-1111-111111111111";
const STRANGER = "22222222-2222-2222-2222-222222222222";

describe.skipIf(!TEST_DATABASE_URL)("database security rules", () => {
  let db: Client;

  beforeAll(async () => {
    db = await freshDatabase();
    await db.query(
      `insert into auth.users (id, email) values ($1, 'member@example.com'), ($2, 'stranger@example.com')`,
      [MEMBER, STRANGER],
    );
    await db.query(
      `insert into public.members (user_id, email, display_name) values ($1, 'member@example.com', 'Member')`,
      [MEMBER],
    );
  });

  afterAll(async () => {
    await db?.end();
  });

  it("seeds the starting categories", async () => {
    const { rows } = await db.query("select name, kind from public.categories order by sort_order");
    expect(rows).toHaveLength(15);
    expect(rows.filter((r) => r.kind === "expense")).toHaveLength(13);
  });

  it("lets a member read and write", async () => {
    const rows = await asUser(db, MEMBER, async () => {
      await db.query(
        `insert into public.transactions (date, description, amount, direction) values ('2026-10-01', 'NTUC FAIRPRICE', 12.5, 'debit')`,
      );
      return (await db.query("select * from public.transactions")).rows;
    });
    expect(rows).toHaveLength(1);
    expect(await asUser(db, MEMBER, async () => (await db.query("select * from public.categories")).rowCount)).toBe(15);
  });

  it("hides everything from a logged-in stranger", async () => {
    const count = await asUser(db, STRANGER, async () => {
      return (await db.query("select * from public.transactions")).rowCount;
    });
    expect(count).toBe(0);
    await expect(
      asUser(db, STRANGER, () =>
        db.query(
          `insert into public.transactions (date, description, amount, direction) values ('2026-10-01', 'x', 1, 'debit')`,
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("blocks logged-out visitors completely", async () => {
    await expect(asUser(db, null, () => db.query("select * from public.transactions"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("does not let a member add new members", async () => {
    await expect(
      asUser(db, MEMBER, () =>
        db.query(
          `insert into public.members (user_id, email, display_name) values ($1, 'stranger@example.com', 'x')`,
          [STRANGER],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
