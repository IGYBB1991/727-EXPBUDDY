// Hides details we never want to send to Claude: long numbers (account,
// card and reference numbers) and email addresses. Dates and amounts are
// short enough to survive.
export function maskPrivateDetails(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\d(?:[ -]?\d){5,}/g, (digits) => `${"#".repeat(4)}${digits.replace(/\D/g, "").slice(-2)}`);
}
