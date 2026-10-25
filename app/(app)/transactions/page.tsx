import Link from "next/link";
import { Download } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireMember } from "@/lib/auth";
import { listAccounts } from "@/lib/db/accounts";
import { listCategories } from "@/lib/db/categories";
import { listMembers } from "@/lib/db/members";
import { MAX_LISTED, listTransactions } from "@/lib/db/transactions";
import { formatSGD, sumMoney } from "@/lib/money";
import { isMonth, monthFromParam } from "@/lib/months";
import { filtersFromParams } from "@/lib/transaction-query";
import { AddTransactionButton } from "./add-transaction";
import { TransactionFilters } from "./filters";
import { TransactionList } from "./transaction-list";

export default async function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  const params = await searchParams;
  const month = params.month === "all" ? "all" : monthFromParam(params.month);
  const { supabase, member } = await requireMember();
  const [members, categories, accounts] = await Promise.all([
    listMembers(supabase),
    listCategories(supabase),
    listAccounts(supabase),
  ]);
  const transactions = await listTransactions(supabase, filtersFromParams(params, member, members));

  const spent = sumMoney(transactions.filter((t) => t.direction === "debit").map((t) => t.amount));
  const received = sumMoney(transactions.filter((t) => t.direction === "credit").map((t) => t.amount));
  const exportParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string") exportParams.set(key, value);
  if (!isMonth(params.month) && month !== "all") exportParams.set("month", month);
  const partner = members.find((m) => m.id !== member.id) ?? null;

  return (
    <>
      <PageHeader
        title="Transactions"
        actions={
          <>
            <AddTransactionButton categories={categories} myName={member.display_name} partnerName={partner?.display_name ?? null} />
            <Button asChild variant="outline">
              <Link href={`/api/export?${exportParams.toString()}`} prefetch={false}>
                <Download />
                Export CSV
              </Link>
            </Button>
          </>
        }
      />
      <TransactionFilters
        month={month}
        categories={categories}
        accounts={accounts}
        partnerName={partner?.display_name ?? null}
      />
      <p className="mt-4 mb-2 text-sm text-muted-foreground">
        {transactions.length} transaction{transactions.length === 1 ? "" : "s"} · {formatSGD(spent)} out ·{" "}
        {formatSGD(received)} in
        {transactions.length >= MAX_LISTED && ` · showing the newest ${MAX_LISTED}, narrow the filters to see more`}
      </p>
      <TransactionList
        transactions={transactions}
        categories={categories}
        accounts={accounts}
        members={members}
      />
    </>
  );
}
