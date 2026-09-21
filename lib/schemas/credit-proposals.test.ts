import { describe, expect, it } from "vitest";

import { createCreditProposalSchema } from "./credit-proposals";

const proposal = {
  contact_id: "11111111-1111-4111-8111-111111111111",
  product: "Credito",
};

describe("credit proposal interest rate", () => {
  it("accepts the numeric(9,6) maximum", () => {
    expect(
      createCreditProposalSchema.safeParse({
        ...proposal,
        interest_rate: 999.999999,
      }).success,
    ).toBe(true);
  });

  it("rejects values above the numeric(9,6) maximum", () => {
    expect(
      createCreditProposalSchema.safeParse({
        ...proposal,
        interest_rate: 1000,
      }).success,
    ).toBe(false);
  });
});
