// Money helpers. Everything is in Singapore dollars.

const formatter = new Intl.NumberFormat("en-SG", {
  style: "currency",
  currency: "SGD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeFormatter = new Intl.NumberFormat("en-SG", {
  style: "currency",
  currency: "SGD",
  maximumFractionDigits: 0,
});

export function formatSGD(amount: number, opts: { whole?: boolean } = {}): string {
  return (opts.whole ? wholeFormatter : formatter).format(amount);
}

// Rounds to cents, avoiding floating point surprises like 0.1 + 0.2.
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function sumMoney(amounts: number[]): number {
  return roundMoney(amounts.reduce((total, a) => total + a, 0));
}
