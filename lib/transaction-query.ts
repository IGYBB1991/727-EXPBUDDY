import type { TransactionFilters } from "@/lib/db/transactions";
import { monthFromParam } from "@/lib/months";
import { ownerParam, toOwnerFilter } from "@/lib/owner-filter";
import type { Member } from "@/lib/types";

type Params = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f-]{36}$/;

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

// Reads the Transactions page filters from the address bar. The page and the
// CSV export both use this, so the export always matches what's on screen.
export function filtersFromParams(params: Params, me: Member, members: Member[]): TransactionFilters {
  const category = single(params.category);
  const account = single(params.account);
  return {
    month: params.month === "all" ? "all" : monthFromParam(params.month),
    categoryId: category === "none" || (category && UUID.test(category)) ? category : undefined,
    owner: toOwnerFilter(ownerParam(params.owner), me, members),
    accountId: account && UUID.test(account) ? account : undefined,
    needsReview: params.review === "1",
    search: single(params.q)?.slice(0, 100),
  };
}
