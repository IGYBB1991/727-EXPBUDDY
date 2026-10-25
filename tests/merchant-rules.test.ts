import { describe, expect, it } from "vitest";

import { findRule, patternFor } from "@/lib/merchant-rules";
import { maskPrivateDetails } from "@/lib/privacy";

const rules = [
  { merchant_pattern: "ntuc", category_id: "groceries" },
  { merchant_pattern: "grab", category_id: "transport" },
  { merchant_pattern: "grabfood", category_id: "delivery" },
  { merchant_pattern: "toast box", category_id: "dining" },
];

describe("merchant rules", () => {
  it("matches whole words in the description", () => {
    expect(findRule({ description: "POS NTUC FP-BEDOK MALL" }, rules)?.category_id).toBe("groceries");
    expect(findRule({ description: "GRAB*A-7XYZ123 SINGAPORE" }, rules)?.category_id).toBe("transport");
    expect(findRule({ description: "TOAST BOX - CHANGI" }, rules)?.category_id).toBe("dining");
  });

  it("doesn't match parts of words", () => {
    expect(findRule({ description: "GRABBAG STORE" }, rules)).toBeNull();
  });

  it("prefers the longest matching pattern", () => {
    const more = [...rules, { merchant_pattern: "grab food", category_id: "delivery" }];
    expect(findRule({ description: "GRAB FOOD 123" }, more)?.category_id).toBe("delivery");
  });

  it("also matches on the cleaned merchant name", () => {
    expect(findRule({ description: "UMC 8812 SG", merchant: "GrabFood" }, rules)?.category_id).toBe("delivery");
    expect(findRule({ description: "something else" }, rules)).toBeNull();
  });

  it("builds patterns from the merchant name, or the description without numbers", () => {
    expect(patternFor({ merchant: "NTUC FairPrice", description: "x" })).toBe("ntuc fairprice");
    expect(patternFor({ merchant: null, description: "KOPITIAM @ TAMPINES 12345" })).toBe("kopitiam tampines");
  });
});

describe("privacy masking", () => {
  it("hides long numbers and emails but keeps dates and amounts", () => {
    expect(maskPrivateDetails("PAYNOW TO 91234567 REF 0012345678")).toBe("PAYNOW TO ####67 REF ####78");
    expect(maskPrivateDetails("CARD 4111-1111-1111-1234")).toBe("CARD ####34");
    expect(maskPrivateDetails("jason@gmail.com paid")).toBe("[email] paid");
    expect(maskPrivateDetails("01/10/2026 3,500.00")).toBe("01/10/2026 3,500.00");
  });
});
