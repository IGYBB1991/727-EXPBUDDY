import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

// Database tests run only when TEST_DATABASE_URL points at an empty local
// Postgres database. They are skipped otherwise.
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const root = path.resolve(__dirname, "../..");

export async function freshDatabase(): Promise<Client> {
  const admin = new Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  const name = `test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(TEST_DATABASE_URL!);
  url.pathname = `/${name}`;
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  await db.query(readFileSync(path.join(root, "tests/db/supabase-stub.sql"), "utf8"));
  const dir = path.join(root, "supabase/migrations");
  for (const file of readdirSync(dir).sort()) {
    await db.query(readFileSync(path.join(dir, file), "utf8"));
  }
  return db;
}

// Run a callback as a logged-in Supabase user (or logged out when userId is null).
export async function asUser<T>(
  db: Client,
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.query("begin");
  try {
    await db.query(`set local role ${userId ? "authenticated" : "anon"}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    const result = await fn();
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}
