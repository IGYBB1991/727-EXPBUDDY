import type { Direction } from "@/lib/types";

// What the review screen shows for each transaction read from a statement.
export type ReviewTransaction = {
  key: string;
  date: string;
  description: string;
  merchant: string | null;
  amount: number;
  direction: Direction;
  categoryId: string | null;
  confidence: number | null;
  needsReview: boolean;
  // How the category was chosen: a saved merchant rule, Claude, or not yet.
  categorizedBy: "rule" | "ai" | null;
  duplicateOf: { date: string; description: string; amount: number; alreadySaved: boolean } | null;
};

export type ReviewFile = {
  key: string;
  fileName: string;
  bank: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  transactions: ReviewTransaction[];
  error: string | null;
};

// Files above this size can't pass through Vercel's servers in one request.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
