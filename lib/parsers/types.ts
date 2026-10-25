import type { Direction } from "@/lib/types";

// One transaction read from a statement, before it's categorized or saved.
export type ParsedTransaction = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // always positive, 2 decimals
  direction: Direction;
};

export type ParsedStatement = {
  bank: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  transactions: ParsedTransaction[];
};

// Thrown with a message that's safe to show to the person uploading.
export class StatementError extends Error {}
