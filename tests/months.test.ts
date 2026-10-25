import { describe, expect, it } from "vitest";

import { addMonths, currentMonth, formatMonth, lastMonths, monthRange } from "@/lib/months";

describe("months", () => {
  it("uses Singapore time for the current month", () => {
    // 31 Oct 2026 20:00 UTC is already 1 Nov in Singapore.
    expect(currentMonth(new Date("2026-10-31T20:00:00Z"))).toBe("2026-11");
  });

  it("adds and subtracts months across years", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(lastMonths("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("knows the last day of each month", () => {
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange("2026-04").to).toBe("2026-04-30");
  });

  it("formats month names", () => {
    expect(formatMonth("2026-10")).toBe("October 2026");
  });
});
