import { formatSGD } from "@/lib/money";
import type { Direction } from "@/lib/types";
import { cn } from "@/lib/utils";

// Money out shows as a plain amount; money in shows green with a plus sign.
export function Amount({ amount, direction, className }: { amount: number; direction: Direction; className?: string }) {
  return (
    <span className={cn("font-medium whitespace-nowrap tabular-nums", direction === "credit" && "text-primary", className)}>
      {direction === "credit" ? "+" : ""}
      {formatSGD(amount)}
    </span>
  );
}
