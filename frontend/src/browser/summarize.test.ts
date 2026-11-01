import { describe, expect, it } from "vitest";
import { splitSentences, summarizeExtractively } from "./summarize";

describe("extractive browser summarizer", () => {
  it("selects important original sentences and preserves their order", () => {
    const source = [
      "The cloud workshop begins on Monday.",
      "Students may bring lunch.",
      "Cloud workshop registration closes Friday.",
      "The cloud workshop includes an Azure demonstration.",
      "Parking is available outside.",
    ].join(" ");
    const summary = summarizeExtractively(source, 2);
    expect(splitSentences(summary)).toHaveLength(2);
    expect(source).toContain(splitSentences(summary)[0]);
    expect(source).toContain(splitSentences(summary)[1]);
    expect(summary.toLowerCase()).toContain("cloud workshop");
  });

  it("returns short documents without inventing text", () => {
    const source = "First sentence. Second sentence.";
    expect(summarizeExtractively(source, 3)).toBe(source);
  });
});
