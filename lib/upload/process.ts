import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { findDuplicates } from "@/lib/duplicates";
import { fetchAllPages } from "@/lib/db/paging";
import { parseCsv, type ColumnInferrer } from "@/lib/parsers/csv/parse";
import { StatementError, type ParsedStatement, type ParsedTransaction } from "@/lib/parsers/types";
import type { Direction } from "@/lib/types";
import type { ReviewFile, ReviewTransaction } from "./types";

export type IncomingFile = { name: string; type: string; bytes: ArrayBuffer };

export type CategorizeResult = {
  categoryId: string | null;
  merchant: string | null;
  confidence: number | null;
  needsReview: boolean;
  categorizedBy: "rule" | "ai" | null;
};

export type ProcessDeps = {
  categorize?: (transactions: ParsedTransaction[]) => Promise<CategorizeResult[]>;
  inferColumns?: ColumnInferrer;
  parsePdf?: (bytes: ArrayBuffer) => Promise<ParsedStatement>;
};

const UNCATEGORIZED: CategorizeResult = {
  categoryId: null,
  merchant: null,
  confidence: null,
  needsReview: true,
  categorizedBy: null,
};

async function parseFile(file: IncomingFile, deps: ProcessDeps): Promise<ParsedStatement> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const text = new TextDecoder("utf-8").decode(file.bytes);
    return parseCsv(text, { inferColumns: deps.inferColumns });
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    if (!deps.parsePdf) throw new StatementError("PDF statements aren't supported yet. Please upload a CSV.");
    return deps.parsePdf(file.bytes);
  }
  throw new StatementError("Only .csv and .pdf files can be uploaded.");
}

type SavedTransaction = { date: string; description: string; amount: number; direction: Direction };

async function savedTransactionsBetween(supabase: SupabaseClient, from: string, to: string) {
  const rows = await fetchAllPages<SavedTransaction>((start, end) =>
    supabase
      .from("transactions")
      .select("date, description, amount, direction")
      .is("split_parent_id", null)
      .gte("date", from)
      .lte("date", to)
      .order("date")
      .range(start, end),
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

// Reads every file, flags likely duplicates and suggests categories. Nothing
// is saved here: the person checks everything on the review screen first.
export async function processUploads(
  supabase: SupabaseClient,
  files: IncomingFile[],
  deps: ProcessDeps = {},
): Promise<ReviewFile[]> {
  const parsed = await Promise.all(
    files.map(async (file, index) => {
      try {
        return { file, index, statement: await parseFile(file, deps), error: null };
      } catch (error) {
        if (!(error instanceof StatementError)) console.error(`Could not read ${file.name}`, error);
        const message =
          error instanceof StatementError ? error.message : "Something went wrong reading this file. Please try again.";
        return { file, index, statement: null, error: message };
      }
    }),
  );

  const all = parsed.flatMap((p) =>
    (p.statement?.transactions ?? []).map((t, i) => ({ ...t, source: `${p.index}`, key: `${p.index}-${i}` })),
  );

  let duplicates: ReturnType<typeof findDuplicates<(typeof all)[number], SavedTransaction>> = [];
  let categories: CategorizeResult[] = [];
  if (all.length > 0) {
    const dates = all.map((t) => t.date).sort();
    const saved = await savedTransactionsBetween(supabase, dates[0], dates.at(-1)!);
    duplicates = findDuplicates(all, saved);
    categories = deps.categorize ? await deps.categorize(all) : all.map(() => UNCATEGORIZED);
  }

  const reviewed = new Map<string, ReviewTransaction>();
  all.forEach((t, i) => {
    const dup = duplicates[i];
    reviewed.set(t.key, {
      key: t.key,
      date: t.date,
      description: t.description,
      amount: t.amount,
      direction: t.direction,
      ...categories[i],
      duplicateOf: dup
        ? { date: dup.date, description: dup.description, amount: dup.amount, alreadySaved: !("source" in dup) }
        : null,
    });
  });

  return parsed.map((p) => ({
    key: `${p.index}`,
    fileName: p.file.name,
    bank: p.statement?.bank ?? null,
    periodStart: p.statement?.periodStart ?? null,
    periodEnd: p.statement?.periodEnd ?? null,
    error: p.error,
    transactions: (p.statement?.transactions ?? []).map((_, i) => reviewed.get(`${p.index}-${i}`)!),
  }));
}
