import "server-only";

import { z } from "zod";

import { askForJson } from "@/lib/claude";
import type { ColumnMap } from "@/lib/parsers/csv/columns";
import type { PdfExtraction } from "@/lib/parsers/pdf";
import { maskPrivateDetails } from "@/lib/privacy";

// The jobs we give Claude. Only dates, descriptions (with long numbers and
// emails hidden) and amounts are ever sent: never names, emails or account
// numbers from the app.

export type AiTransaction = { id: string; date: string; description: string; amount: number; moneyIn: boolean };
export type AiCategory = { name: string; kind: string; group: string | null };
export type AiCategorization = { id: string; merchant: string; category: string; confidence: number };

const SINGAPORE_CONTEXT = `You categorize bank and credit card transactions for a household in Singapore. Amounts are in SGD.

Local knowledge:
- NTUC FairPrice (also "FP", "FairPrice Xtra", "Finest"), Cold Storage, Sheng Siong, Giant, Don Don Donki, Prime, Hao Mart and wet markets are supermarkets or grocers.
- Kopitiam, Koufu, Food Republic, hawker centres, Toast Box, Ya Kun Kaya Toast, Old Chang Kee, cafes and restaurants are dining out.
- GrabFood, foodpanda, Deliveroo and "Grab Food" are food delivery.
- "GRAB" or "GRAB*" on its own can be a ride (transport) or a food order (food delivery). Use any hint in the description ("GRABFOOD", "GF", "GRABCAR", "GRAB RIDES"); if there is none, choose transport and give a low confidence.
- Gojek, ComfortDelGro, CDG, TADA, Ryde, BUS/MRT, EZ-Link, SimplyGo, TransitLink, petrol (Shell, Esso, SPC, Caltex), parking, ERP and LTA are transport.
- SP Group / SP Digital (electricity, water, gas), Singtel, StarHub, M1, SIMBA, Circles.Life, MyRepublic and ViewQwest are utilities and bills.
- Town council conservancy, HDB, rent, mortgage, MCST or condo fees are housing.
- Shopee, Lazada, Amazon, Taobao, Qoo10, Uniqlo, IKEA and department stores are shopping.
- Polyclinics, GP clinics, Guardian, Watsons, Unity pharmacy and insurers (AIA, Prudential, Great Eastern, NTUC Income) are health.
- PayNow, PayLah!, FAST, GIRO payments to people, transfers between own accounts and credit card bill payments ("PAYMENT - THANK YOU") are transfers.
- Salary, interest, cashback, refunds from employers and dividends are income.
- NETS, "POS" and "NETS QR" just mean the payment method; look at the merchant name after it.`;

// Category names are checked afterwards rather than in the schema, so one
// odd answer only affects that row (it's left for the person to pick).
const categorySchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      merchant: z.string(),
      category: z.string(),
      confidence: z.number(),
    }),
  ),
});

export async function categorizeWithClaude(
  transactions: AiTransaction[],
  categories: AiCategory[],
): Promise<AiCategorization[]> {
  const list = categories
    .map((c) => `- ${c.name}${c.group ? ` (part of ${c.group})` : ""}${c.kind !== "expense" ? ` [${c.kind}, not spending]` : ""}`)
    .join("\n");
  const rows = transactions.map((t) => ({
    id: t.id,
    date: t.date,
    description: maskPrivateDetails(t.description),
    amount: t.moneyIn ? -t.amount : t.amount,
  }));

  const answer = await askForJson({
    system: SINGAPORE_CONTEXT,
    schema: categorySchema,
    content: `Categorize each transaction below. A positive amount is money spent; a negative amount is money received (refund, income or transfer in).

Use only these categories:
${list}

For each transaction return:
- id: copied exactly
- merchant: a short, clean merchant name a person would recognize (e.g. "NTUC FairPrice", "Grab", "Netflix"), without branch names, locations or reference numbers
- category: one of the categories above, spelled exactly
- confidence: from 0 to 1, how sure you are of the category

Transactions:
${JSON.stringify(rows)}`,
    check: (value) => {
      const ids = new Set(value.results.map((r) => r.id));
      const missing = transactions.filter((t) => !ids.has(t.id)).length;
      return missing > 0 ? `${missing} transactions were missing from the answer` : null;
    },
  });

  return answer.results.map((r) => ({ ...r, confidence: Math.min(1, Math.max(0, r.confidence)) }));
}

const columnsSchema = z.object({
  date_column: z.number().int(),
  description_columns: z.array(z.number().int()),
  amount_column: z.number().int().nullable(),
  money_out_column: z.number().int().nullable(),
  money_in_column: z.number().int().nullable(),
  amount_sign_for_money_out: z.enum(["positive", "negative", "unknown"]),
});

// Works out which CSV column is which, from the header and a few rows.
export async function inferColumnsWithClaude(header: string[], samples: string[][]): Promise<ColumnMap | null> {
  const width = Math.max(header.length, ...samples.map((r) => r.length));
  const valid = (i: number | null) => i === null || (i >= 0 && i < width);
  const table = [header, ...samples].map((row) => row.map(maskPrivateDetails));

  const answer = await askForJson({
    system: "You read CSV exports of bank and credit card statements from Singapore banks.",
    schema: columnsSchema,
    maxTokens: 2000,
    content: `Here are the first rows of a bank statement CSV as a JSON array of rows (columns are numbered from 0). The first row may be a header or may already be data.

${JSON.stringify(table)}

Say which column holds the transaction date, which column(s) hold the description, and where the amount is: either one amount column, or separate money out (withdrawal/debit) and money in (deposit/credit) columns. Use null for columns that don't exist. If there's one amount column, say whether money out is shown as positive or negative numbers ("unknown" if you can't tell).`,
    check: (a) => {
      const columns = [a.date_column, a.amount_column, a.money_out_column, a.money_in_column, ...a.description_columns];
      if (!columns.every(valid)) return "a column number was out of range";
      if (a.description_columns.length === 0) return "no description column";
      if (a.amount_column === null && a.money_out_column === null && a.money_in_column === null) return "no amount column";
      return null;
    },
  });

  return {
    date: answer.date_column,
    description: answer.description_columns,
    ...(answer.amount_column !== null
      ? {
          amount: answer.amount_column,
          amountSign:
            answer.amount_sign_for_money_out === "positive"
              ? ("positive-is-debit" as const)
              : answer.amount_sign_for_money_out === "negative"
                ? ("negative-is-debit" as const)
                : ("auto" as const),
        }
      : {}),
    ...(answer.money_out_column !== null ? { debit: answer.money_out_column } : {}),
    ...(answer.money_in_column !== null ? { credit: answer.money_in_column } : {}),
  };
}

const pdfSchema = z.object({
  bank: z.string().nullable(),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  transactions: z.array(
    z.object({
      date: z.string(),
      description: z.string(),
      amount: z.number(),
      direction: z.enum(["debit", "credit"]),
    }),
  ),
});

// Reads the transactions out of a PDF statement. The whole PDF has to be
// sent for this, so the README suggests CSV downloads where a bank offers them.
export async function extractPdfWithClaude(bytes: ArrayBuffer): Promise<PdfExtraction> {
  return askForJson({
    system: "You extract transactions from Singapore bank and credit card statements accurately and completely.",
    schema: pdfSchema,
    maxTokens: 32000,
    effort: "medium",
    content: [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: Buffer.from(bytes).toString("base64") },
      },
      {
        type: "text",
        text: `List every transaction in this statement, in the order shown.

For each transaction give:
- date: the transaction date as YYYY-MM-DD (if the statement shows only day and month, use the year from the statement period)
- description: the description exactly as printed, on one line
- amount: a positive number in SGD (for foreign currency charges, the SGD amount)
- direction: "debit" for money out (purchases, withdrawals, fees, interest charged) or "credit" for money in (deposits, refunds, payments to the card, cashback)

Leave out anything that isn't a transaction: opening, closing or previous balances, "balance brought/carried forward", subtotals, totals, minimum payment and credit limit lines.

Also give the bank's name (e.g. "DBS", "OCBC", "UOB", "Citibank", "Standard Chartered", "HSBC", "Trust Bank") and the statement period start and end dates as YYYY-MM-DD (null if not shown).`,
      },
    ],
  });
}
