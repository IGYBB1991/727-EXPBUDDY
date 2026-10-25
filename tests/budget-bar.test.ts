import { describe, expect, it } from "vitest";

import { budgetStatus } from "@/components/budget-bar";

describe("budget status", () => {
  it("turns amber at 80% and red at 100%", () => {
    expect(budgetStatus(79.99, 100)).toBe("ok");
    expect(budgetStatus(80, 100)).toBe("warning");
    expect(budgetStatus(99.99, 100)).toBe("warning");
    expect(budgetStatus(100, 100)).toBe("over");
  });

  it("treats spending with no budget as over", () => {
    expect(budgetStatus(10, 0)).toBe("over");
    expect(budgetStatus(0, 0)).toBe("ok");
  });
});
