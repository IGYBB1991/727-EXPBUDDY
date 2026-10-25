import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/month-picker";
import { requireMember } from "@/lib/auth";
import { listBudgets } from "@/lib/db/budgets";
import { listCategories } from "@/lib/db/categories";
import { monthlySpending, totalsByCategory } from "@/lib/db/spending";
import { monthFromParam } from "@/lib/months";
import { BudgetEditor, type BudgetRow } from "./budget-editor";

export default async function BudgetsPage({ searchParams }: PageProps<"/budgets">) {
  const month = monthFromParam((await searchParams).month);
  const { supabase } = await requireMember();

  const [categories, budgets, spending] = await Promise.all([
    listCategories(supabase),
    listBudgets(supabase, [month]),
    monthlySpending(supabase, month, month),
  ]);
  const spent = totalsByCategory(spending);
  const budgetByCategory = new Map(budgets.map((b) => [b.category_id, b.amount]));

  // Show active spending categories, plus hidden ones that still have a
  // budget or spending this month.
  const rows: BudgetRow[] = categories
    .filter(
      (c) =>
        c.kind === "expense" &&
        (c.is_active || budgetByCategory.has(c.id) || (spent.get(c.id) ?? 0) !== 0),
    )
    .map((c) => ({
      category: c,
      budget: budgetByCategory.get(c.id) ?? null,
      spent: spent.get(c.id) ?? 0,
    }));

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Set a monthly budget for each category and see how you're tracking."
        actions={<MonthPicker month={month} />}
      />
      <BudgetEditor key={month} month={month} rows={rows} uncategorized={spent.get(null) ?? 0} />
    </>
  );
}
