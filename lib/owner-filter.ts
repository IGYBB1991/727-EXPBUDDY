import type { OwnerFilter } from "@/lib/dashboard";
import type { Member } from "@/lib/types";

// The Mine / partner's / Joint / All filter, as it appears in the address
// bar (?owner=mine).
export type OwnerParam = "all" | "mine" | "partner" | "joint";

export function ownerParam(value: string | string[] | undefined): OwnerParam {
  return value === "mine" || value === "partner" || value === "joint" ? value : "all";
}

export function toOwnerFilter(param: OwnerParam, me: Member, members: Member[]): OwnerFilter {
  if (param === "all") return { all: true };
  if (param === "joint") return { all: false, ownerId: null };
  if (param === "mine") return { all: false, ownerId: me.id };
  const partner = members.find((m) => m.id !== me.id);
  // No partner yet: nothing can be theirs.
  return { all: false, ownerId: partner?.id ?? "00000000-0000-0000-0000-000000000000" };
}
