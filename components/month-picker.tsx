"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { addMonths, currentMonth, formatMonth } from "@/lib/months";

// Previous / next month arrows that update ?month= in the address bar.
export function MonthPicker({ month }: { month: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(target: string) {
    const params = new URLSearchParams(searchParams);
    params.set("month", target);
    return `${pathname}?${params.toString()}`;
  }

  const isCurrent = month === currentMonth();

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
      <Button asChild variant="ghost" size="icon-sm">
        <Link href={hrefFor(addMonths(month, -1))} aria-label="Previous month">
          <ChevronLeft />
        </Link>
      </Button>
      <span className="min-w-32 text-center text-sm font-medium">{formatMonth(month)}</span>
      <Button asChild variant="ghost" size="icon-sm" disabled={isCurrent}>
        <Link
          href={hrefFor(addMonths(month, 1))}
          aria-label="Next month"
          aria-disabled={isCurrent}
          className={isCurrent ? "pointer-events-none opacity-40" : undefined}
        >
          <ChevronRight />
        </Link>
      </Button>
    </div>
  );
}
