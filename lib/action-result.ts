import { NotSignedInError } from "@/lib/auth";

// What every server action returns, so the page can show a friendly message.
export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export function actionError(error: unknown, fallback = "Something went wrong. Please try again."): ActionResult<never> {
  if (error instanceof NotSignedInError) return { ok: false, error: error.message };
  const code = (error as { code?: string } | null)?.code;
  if (code === "23505") return { ok: false, error: "That name is already in use." };
  console.error(error);
  return { ok: false, error: fallback };
}
