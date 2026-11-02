import { describe, expect, it } from "vitest";
import { selectSemanticSummary } from "./semantic";
import { splitSentences, summarizeExtractively } from "./summarize";

describe("summarizer boundary cases", () => {
  it("returns empty output for whitespace-only input", () => {
    expect(summarizeExtractively(" \n\t ")).toBe("");
    expect(selectSemanticSummary(" \n\t ", [])).toBe("");
  });

  it("retains a short document in full", () => {
    const text = "The launch is postponed. The new date is Friday.";
    expect(selectSemanticSummary(text, [[1, 0], [0, 1]], 3)).toBe(text);
  });

  it("selects exactly the requested number of source sentences in source order", () => {
    const sentences = [
      "Lunch is available outside.",
      "Cloud deployment starts Monday.",
      "Cloud deployment requires approval.",
      "Cloud deployment finishes Friday.",
      "Parking is free today.",
    ];
    const text = sentences.join(" ");
    const vectors = [[0, 1], [1, 0], [0.9, 0.1], [1, 0.2], [-1, 0]];
    for (const count of [1, 2, 3]) {
      for (const summary of [
        summarizeExtractively(text, count),
        selectSemanticSummary(text, vectors, count),
      ]) {
        const selected = splitSentences(summary);
        expect(selected).toHaveLength(count);
        const indices = selected.map((sentence) => sentences.indexOf(sentence));
        expect(indices.every((index) => index >= 0)).toBe(true);
        expect(indices).toEqual([...indices].sort((a, b) => a - b));
      }
    }
  });

  it("normalizes vector magnitudes before selecting sentences", () => {
    const text = "Cloud systems reduce latency. Edge systems reduce latency. Privacy rules keep sensitive data local. Registration closes Friday.";
    const vectors = [[1, 0], [0.99, 0.01], [0, 1], [-1, 0]];
    const scaled = vectors.map((vector, index) => vector.map((value) => value * (index + 1) * 10));
    expect(selectSemanticSummary(text, scaled, 2)).toBe(selectSemanticSummary(text, vectors, 2));
  });

  it("handles zero vectors without invalid output", () => {
    const text = "First point. Second point. Third point. Fourth point.";
    expect(selectSemanticSummary(text, Array.from({ length: 4 }, () => [0, 0]), 2))
      .toBe("First point. Second point.");
  });
});

// These characterize current limitations; passing does not mean good summary quality.
describe("summarizer known limitations", () => {
  it("excludes even a highly relevant conclusion after sentence 48", () => {
    const opening = Array.from({ length: 48 }, (_, i) => `Routine project update number ${i + 1}.`);
    const conclusion = "Critical conclusion: cancel the deployment because customer data is exposed.";
    const text = [...opening, conclusion].join(" ");
    const summary = selectSemanticSummary(text, Array.from({ length: 48 }, () => [1, 0]), 3);
    expect(splitSentences(summary)).toHaveLength(3);
    expect(summary).not.toContain(conclusion);
  });

  it("returns more than the requested count when embeddings are missing", () => {
    const text = "First point. Second point. Third point. Fourth point.";
    expect(selectSemanticSummary(text, [[1, 0]], 2)).toBe(text);
  });

  it("can repeat identical sentences despite the redundancy penalty", () => {
    const repeated = "Cloud deployment improves service availability.";
    const text = `${repeated} ${repeated} ${repeated} Parking is available.`;
    const vectors = [[1, 0], [1, 0], [1, 0], [-1, 0]];
    expect(selectSemanticSummary(text, vectors, 2)).toBe(`${repeated} ${repeated}`);
    expect(summarizeExtractively(text, 2)).toBe(`${repeated} ${repeated}`);
  });
});
