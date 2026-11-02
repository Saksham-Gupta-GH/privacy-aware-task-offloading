import { describe, expect, it } from "vitest";
import cases from "../../../tests/segmentation_cases.json";
import { splitSentences } from "./summarize";

describe("structure-aware summarizer segmentation", () => {
  for (const example of cases) {
    it(example.name, () => {
      expect(splitSentences(example.input)).toEqual(example.expected);
    });
  }
  it("does not arbitrarily cut a long unpunctuated line at 35 words", () => {
    const source = Array.from({ length: 80 }, (_, index) => `word${index}`).join(" ");
    expect(splitSentences(source)).toEqual([source]);
  });
});
