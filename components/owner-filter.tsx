"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import type { OwnerParam } from "@/lib/owner-filter";
import { cn } from "@/lib/utils";

export function OwnerFilterControl({ value, partnerName }: { value: OwnerParam; partnerName: string | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const options: [OwnerParam, string][] = [
    ["mine", "Mine"],
    ["partner", partnerName ? `${partnerName}'s` : "Partner's"],
    ["joint", "Joint"],
    ["all", "All"],
  ];

  function hrefFor(owner: OwnerParam) {
    const params = new URLSearchParams(searchParams);
    if (owner === "all") params.delete("owner");
    else params.set("owner", owner);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <div className="flex rounded-lg border bg-card p-1" role="group" aria-label="Whose spending">
      {options.map(([option, label]) => (
        <Link
          key={option}
          href={hrefFor(option)}
          aria-current={value === option ? "true" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
            value === option && "bg-primary text-primary-foreground hover:text-primary-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
