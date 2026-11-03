import { describe, expect, it } from "vitest";
import { classifyInBrowser } from "./privacy";
import adversarialCases from "../../../data/synthetic/privacy-adversarial-cases.json";

describe("browser privacy classifier", () => {
  it("keeps payment-card content local", () => {
    const result = classifyInBrowser("Credit card number 4111 1111 1111 1111, expiry 12/30, CVV 123.");
    expect(result.sensitivity).toBe("restricted");
    expect(result.allowedDestinations).toEqual(["local"]);
  });

  it("permits a public notice on all tiers", () => {
    const result = classifyInBrowser("The public technology festival begins Monday. Everyone is welcome.");
    expect(result.sensitivity).toBe("public");
    expect(result.allowedDestinations).toEqual(["local", "edge", "cloud"]);
  });

  it("allows private contact information only on local and trusted edge", () => {
    const result = classifyInBrowser("Personal contact: student@example.test");
    expect(result.sensitivity).toBe("personal");
    expect(result.allowedDestinations).toEqual(["local", "edge"]);
  });

  it("detects an email followed by sentence punctuation", () => {
    const result = classifyInBrowser("Résumé contact: aarya@example.test. Available from June.");
    expect(result.sensitivity).toBe("personal");
    expect(result.allowedDestinations).toEqual(["local", "edge"]);
  });

  it("uses a conservative fallback for unreadable content", () => {
    const result = classifyInBrowser("   ");
    expect(result.sensitivity).toBe("uncertain");
    expect(result.manualReviewRequired).toBe(true);
  });

  it("does not mistake an explicitly labelled order number for a payment card", () => {
    const result = classifyInBrowser("Order number: 4111 1111 1111 1111. Ready for collection.");
    expect(result.sensitivity).toBe("public");
  });

  it("keeps a valid card-like number without context local for review", () => {
    const result = classifyInBrowser("Imported value: 4111 1111 1111 1111");
    expect(result.sensitivity).toBe("uncertain");
  });

  it("applies the most restrictive signal in mixed content", () => {
    const result = classifyInBrowser("Public workshop draft. CONFIDENTIAL DOCUMENT. Contact me@example.test");
    expect(result.sensitivity).toBe("restricted");
  });

  it("allows only explicitly published nearby contact details to remain public", () => {
    const result = classifyInBrowser("Public directory. Published contact: events@example.edu or +1 202-555-0147.");
    expect(result.sensitivity).toBe("public");
  });

  it("matches the shared adversarial privacy benchmark", () => {
    for (const testCase of adversarialCases) {
      expect(classifyInBrowser(testCase.content).sensitivity, testCase.id).toBe(testCase.expected);
    }
  });
});
