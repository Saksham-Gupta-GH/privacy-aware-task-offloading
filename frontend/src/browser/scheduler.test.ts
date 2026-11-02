import { describe, expect, it } from "vitest";
import { classifyInBrowser } from "./privacy";
import { decideBrowserPlacement } from "./scheduler";

const workers = {
  edge: { available: true, ready: true, queue_depth: 0 },
  cloud: { available: true, ready: true, queue_depth: 0 },
};

describe("browser placement optimizer", () => {
  it("uses the calibration-v2 local processing and energy model", () => {
    const decision = decideBrowserPlacement({
      classification: classifyInBrowser("Public workshop agenda"),
      workers,
      content: "Public workshop agenda",
      latencyWeight: 1,
      scenario: "live",
    });
    const local = decision.candidates.find((item) => item.tier === "local");
    expect(local?.predictedLatencyMs).toBe(38.4);
    expect(local?.estimatedDeviceEnergyJ).toBe(0.096);
  });

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
