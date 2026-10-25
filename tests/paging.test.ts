import { describe, expect, it } from "vitest";

import { fetchAllPages } from "@/lib/db/paging";

const source = Array.from({ length: 2500 }, (_, i) => i);
const page = (from: number, to: number) => Promise.resolve({ data: source.slice(from, to + 1), error: null });

describe("fetchAllPages", () => {
  it("keeps asking until every row has arrived", async () => {
    expect(await fetchAllPages(page)).toHaveLength(2500);
  });

  it("stops at the limit", async () => {
    const rows = await fetchAllPages(page, 2000);
    expect(rows).toHaveLength(2000);
    expect(rows.at(-1)).toBe(1999);
  });
});
