import { describe, expect, it } from "vitest";
import { buildSearchPassages, selectSemanticSummary } from "./semantic";

describe("browser semantic processing", () => {
  it("chunks long documents for local indexing", () => {
    const content = Array.from({ length: 250 }, (_, index) => `word${index}`).join(" ");
    expect(buildSearchPassages(content, 100)).toHaveLength(3);
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
