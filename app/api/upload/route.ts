import { NextResponse } from "next/server";

import { categorizeWithClaude, extractPdfWithClaude, inferColumnsWithClaude } from "@/lib/ai-tasks";
import { NotSignedInError, requireMemberForAction } from "@/lib/auth";
import { categorizeTransactions } from "@/lib/categorize";
import { listCategories } from "@/lib/db/categories";
import { listRules } from "@/lib/db/rules";
import { checkPdf, cleanPdfExtraction } from "@/lib/parsers/pdf";
import { StatementError } from "@/lib/parsers/types";
import { ClaudeError } from "@/lib/claude";
import { processUploads, type IncomingFile } from "@/lib/upload/process";
import { MAX_UPLOAD_BYTES } from "@/lib/upload/types";

// Reading PDFs and categorizing with Claude can take a while.
export const maxDuration = 300;

// Reads uploaded statements and returns the transactions for review.
// The files are only held in memory and are never stored.
export async function POST(request: Request) {
  let supabase;
  try {
    ({ supabase } = await requireMemberForAction());
  } catch (error) {
    if (error instanceof NotSignedInError) return NextResponse.json({ error: error.message }, { status: 401 });
    throw error;
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "The upload didn't come through. Please try again." }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "Please choose at least one file." }, { status: 400 });
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "These files are too big to upload together (4 MB max). Try uploading them one at a time." },
      { status: 413 },
    );
  }

  const incoming: IncomingFile[] = await Promise.all(
    files.map(async (f) => ({ name: f.name, type: f.type, bytes: await f.arrayBuffer() })),
  );

  try {
    const [categories, rules] = await Promise.all([listCategories(supabase), listRules(supabase)]);
    let aiFailed = false;

    const results = await processUploads(supabase, incoming, {
      categorize: async (transactions) => {
        const outcome = await categorizeTransactions(transactions, categories, rules, categorizeWithClaude);
        aiFailed ||= outcome.aiFailed;
        return outcome.results;
      },
      parsePdf: async (bytes) => {
        checkPdf(bytes);
        try {
          return cleanPdfExtraction(await extractPdfWithClaude(bytes));
        } catch (error) {
          if (error instanceof StatementError) throw error;
          console.error("PDF reading failed", error);
          throw new StatementError(
            error instanceof ClaudeError && /API key/.test(error.message)
              ? error.message
              : "Claude couldn't read this PDF just now. Please try again, or upload a CSV instead.",
          );
        }
      },
      inferColumns: async (header, samples) => {
        try {
          return await inferColumnsWithClaude(header, samples);
        } catch (error) {
          console.error("Column detection failed", error);
          return null;
        }
      },
    });

    return NextResponse.json({
      files: results,
      notice: aiFailed
        ? "Claude couldn't suggest categories for some transactions just now. Please pick those yourself, or go back and try again."
        : null,
    });
  } catch (error) {
    console.error("Upload processing failed", error);
    return NextResponse.json({ error: "Something went wrong reading your statements. Please try again." }, { status: 500 });
  }
}
