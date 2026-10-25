// Parses ALLOWED_EMAILS ("a@gmail.com, b@gmail.com") and checks an email
// against it. Kept free of server-only imports so it can run in the proxy
// and in tests.

export function parseAllowedEmails(setting: string): string[] {
  return setting
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string | null | undefined, setting: string): boolean {
  if (!email) return false;
  return parseAllowedEmails(setting).includes(email.trim().toLowerCase());
}
