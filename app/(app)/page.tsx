import { DashboardView } from "@/components/dashboard/dashboard-view";
import { requireMember } from "@/lib/auth";
import { buildDashboard, type MerchantRow } from "@/lib/dashboard";
import { listBudgets } from "@/lib/db/budgets";
import { listCategories } from "@/lib/db/categories";
import { listMembers } from "@/lib/db/members";
import { monthlySpending } from "@/lib/db/spending";
import { addMonths, monthFromParam, monthRange } from "@/lib/months";
import { ownerParam, toOwnerFilter } from "@/lib/owner-filter";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const month = monthFromParam(params.month);
  const owner = ownerParam(params.owner);
  const historyMonths = params.range === "12" ? 12 : 6;
  const { supabase, member } = await requireMember();

  const { from, to } = monthRange(month);
  const members = await listMembers(supabase);
  const filter = toOwnerFilter(owner, member, members);

  let reviewQuery = supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("needs_review", true)
    .eq("is_split", false);
  if (!filter.all) {
    reviewQuery = filter.ownerId ? reviewQuery.eq("owner_id", filter.ownerId) : reviewQuery.is("owner_id", null);
  }

  const [categories, spending, budgets, merchants, review] = await Promise.all([
    listCategories(supabase),
    monthlySpending(supabase, addMonths(month, -11), month),
    listBudgets(supabase, [month]),
    supabase.rpc("merchant_spending", { p_from: from, p_to: to }),
    reviewQuery,
  ]);
  if (merchants.error) throw merchants.error;

  const d = buildDashboard({
    month,
    historyMonths,
    categories,
    spending,
    budgets,
    merchants: merchants.data as MerchantRow[],
    owner: filter,
  });
  return (
    <DashboardView
      d={d}
      owner={owner}
      historyMonths={historyMonths}
      needsReview={review.count ?? 0}
      partnerName={members.find((m) => m.id !== member.id)?.display_name ?? null}
      params={params}
    />
  );
}
