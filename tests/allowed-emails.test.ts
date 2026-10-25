import { describe, expect, it } from "vitest";

import { isEmailAllowed, parseAllowedEmails } from "@/lib/allowed-emails";

describe("allowed emails", () => {
  it("parses commas, spaces and mixed case", () => {
    expect(parseAllowedEmails(" A@Gmail.com, b@gmail.com ;c@x.sg")).toEqual([
      "a@gmail.com",
      "b@gmail.com",
      "c@x.sg",
    ]);
  });

  it("allows only listed emails, ignoring case", () => {
    const setting = "jason@gmail.com,wife@gmail.com";
    expect(isEmailAllowed("Jason@Gmail.com", setting)).toBe(true);
    expect(isEmailAllowed("someone@gmail.com", setting)).toBe(false);
    expect(isEmailAllowed(undefined, setting)).toBe(false);
    expect(isEmailAllowed("jason@gmail.com", "")).toBe(false);
  });
});
