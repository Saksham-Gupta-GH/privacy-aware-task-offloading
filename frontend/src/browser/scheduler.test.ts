import { describe, expect, it } from "vitest";
import { classifyInBrowser } from "./privacy";
import { decideBrowserPlacement } from "./scheduler";

const workers = {
  edge: { available: true, ready: true, queue_depth: 0 },
  cloud: { available: true, ready: true, queue_depth: 0 },
};

describe("browser placement optimizer", () => {
  it("never offloads restricted input", () => {
    const decision = decideBrowserPlacement({
      classification: classifyInBrowser("Credit card 4111 1111 1111 1111 with CVV 123"),
      workers,
      content: "Credit card 4111 1111 1111 1111 with CVV 123",
      latencyWeight: 1,
      scenario: "client_and_edge_busy",
    });
    expect(decision.selectedTier).toBe("local");
    expect(decision.candidates.find((item) => item.tier === "cloud")?.privacyAllowed).toBe(false);
  });

  it("can choose cloud for public input when local and edge are busy", () => {
    const content = "Public university event schedule and workshop information.";
    const decision = decideBrowserPlacement({
      classification: classifyInBrowser(content),
      workers,
      content,
      latencyWeight: 0.8,
      scenario: "client_and_edge_busy",
    });
    expect(decision.selectedTier).toBe("cloud");
  });

  it("does not choose an offline edge", () => {
    const content = "Private contact student@example.test";
    const decision = decideBrowserPlacement({
      classification: classifyInBrowser(content),
      workers: { ...workers, edge: { available: false, ready: false } },
      content,
      latencyWeight: 0.8,
      scenario: "client_busy",
    });
    expect(decision.selectedTier).toBe("local");
  });
});
