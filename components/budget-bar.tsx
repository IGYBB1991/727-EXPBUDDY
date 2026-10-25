import { cn } from "@/lib/utils";

// Green under 80% of budget, amber from 80%, red at 100% or more.
export function budgetStatus(spent: number, budget: number): "ok" | "warning" | "over" {
  if (budget <= 0) return spent > 0 ? "over" : "ok";
  const ratio = spent / budget;
  if (ratio >= 1) return "over";
  if (ratio >= 0.8) return "warning";
  return "ok";
}

export function BudgetBar({ spent, budget, className }: { spent: number; budget: number; className?: string }) {
  const status = budgetStatus(spent, budget);
  const percent = budget > 0 ? Math.min(100, Math.max(0, (spent / budget) * 100)) : spent > 0 ? 100 : 0;
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all",
          status === "ok" && "bg-primary",
          status === "warning" && "bg-warning",
          status === "over" && "bg-destructive",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
