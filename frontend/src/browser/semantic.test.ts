import { describe, expect, it } from "vitest";
import { buildSearchPassages, rankHybridSearch, selectSemanticSummary } from "./semantic";

describe("browser semantic processing", () => {
  it("chunks long documents for local indexing", () => {
    const content = Array.from({ length: 250 }, (_, index) => `word${index}`).join(" ");
    const passages = buildSearchPassages(content, 100, 25);
    expect(passages).toHaveLength(3);
    expect(passages[0]).toContain("word75");
    expect(passages[1]).toContain("word75");
  });

  it("uses rare exact terms to improve semantic ranking", () => {
    const results = rankHybridSearch("invoice ZXQ-4817", [1, 0], [
      { id: "semantic", name: "billing-guide.txt", passages: [{ text: "General invoice and billing guidance", embedding: [0.95, 0.05] }] },
      { id: "exact", name: "receipt.txt", passages: [{ text: "Receipt for invoice ZXQ-4817 paid on Monday", embedding: [0.75, 0.25] }] },
    ]);
    expect(results[0].documentId).toBe("exact");
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("still finds semantic matches without shared keywords", () => {
    const results = rankHybridSearch("automobile repair", [1, 0], [
      { id: "car", name: "garage.txt", passages: [{ text: "The vehicle needs maintenance", embedding: [0.98, 0.02] }] },
      { id: "food", name: "recipe.txt", passages: [{ text: "Bake the bread until golden", embedding: [0.1, 0.9] }] },
    ]);
    expect(results[0].documentId).toBe("car");
  });

  it("selects relevant but non-duplicate original sentences", () => {
    const content = "Cloud systems reduce latency. Edge systems reduce latency. Privacy rules keep sensitive data local. Registration closes Friday.";
    const embeddings = [
      [1, 0],
      [0.99, 0.01],
      [0, 1],
      [-1, 0],
    ];
    const summary = selectSemanticSummary(content, embeddings, 2);
    expect(summary).toContain("Cloud systems reduce latency.");
    expect(summary).toContain("Privacy rules keep sensitive data local.");
    expect(summary).not.toContain("Edge systems reduce latency.");
  });
});
