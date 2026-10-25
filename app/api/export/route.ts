import { NextResponse, type NextRequest } from "next/server";

import { NotSignedInError, requireMemberForAction } from "@/lib/auth";
import { listAccounts } from "@/lib/db/accounts";
import { listCategories } from "@/lib/db/categories";
import { listMembers } from "@/lib/db/members";
import { listTransactions } from "@/lib/db/transactions";
import { transactionsToCsv } from "@/lib/export-csv";
import { filtersFromParams } from "@/lib/transaction-query";

// Downloads the transactions currently shown on the Transactions page as a
// CSV file (same filters).
export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireMemberForAction();
  } catch (error) {
    if (error instanceof NotSignedInError) return NextResponse.json({ error: error.message }, { status: 401 });
    throw error;
  }
  const { supabase, member } = session;
  const [members, categories, accounts] = await Promise.all([
    listMembers(supabase),
    listCategories(supabase),
    listAccounts(supabase),
  ]);
  const filters = filtersFromParams(Object.fromEntries(request.nextUrl.searchParams), member, members);
  const transactions = await listTransactions(supabase, filters);
  const csv = transactionsToCsv(transactions, { categories, accounts, members });
  const name = filters.month === "all" ? "all-months" : filters.month;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions-${name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
