// Reads settings from environment variables and fails with a clear message
// when one is missing.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Add it to .env.local (or in Vercel's project settings). See .env.example.`,
    );
  }
  return value;
}

// NEXT_PUBLIC_ values must be read with their full literal names so Next.js
// can include them in the build.
export function supabaseUrl() {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabasePublishableKey() {
  return required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function supabaseSecretKey() {
  return required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
}

export function anthropicApiKey() {
  return required("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY);
}

export function claudeModel() {
  return process.env.CLAUDE_MODEL || "claude-haiku-5-5";
}

export function allowedEmailsSetting() {
  return process.env.ALLOWED_EMAILS ?? "";
}
