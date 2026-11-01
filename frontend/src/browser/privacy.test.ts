import { describe, expect, it } from "vitest";
import { classifyInBrowser } from "./privacy";

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

  it("uses a conservative fallback for unreadable content", () => {
    const result = classifyInBrowser("   ");
    expect(result.sensitivity).toBe("uncertain");
    expect(result.manualReviewRequired).toBe(true);
  });
});
