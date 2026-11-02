import { describe, expect, it } from "vitest";
import cases from "../../../tests/structured_summary_cases.json";
import { buildSummaryUnits, selectStructuredSummary, summarizeStructured } from "./structured-summary";

describe("structured summarization", () => {
  for (const sample of cases) it(sample.name, () => {
    const units = buildSummaryUnits(sample.content);
    expect(units.map((u) => u.context)).toEqual(sample.expectedContexts);
    for (const vectors of [undefined, units.map(() => [1, 0])]) {
      const result = selectStructuredSummary(units, vectors, 180);
      for (const text of sample.required) expect(result).toContain(text);
      for (const text of sample.forbidden) expect(result).not.toContain(text);
      expect(result.split(/\s+/).length).toBeLessThanOrEqual(180);
    }
  });

  it("keeps each accomplishment with its own employer or project", () => {
    const units = buildSummaryUnits(cases[0].content);
    expect(units.find((u) => u.text.includes("150×"))?.context).toBe("Atlas - GPU Analytics");
    expect(units.find((u) => u.text.includes("SQL dashboards"))?.context).toBe("Data Analyst Intern — Metro Rail");
    expect(units.every((u) => !/^(Software Development Intern|Atlas - GPU Analytics)$/.test(u.text))).toBe(true);
  });

  it("includes a conclusion beyond the old 48-unit cutoff", () => {
    const source = "BACKGROUND\n" + Array.from({ length: 65 }, (_, i) => `Routine update ${i}.`).join("\n") + "\nCONCLUSION\nCancel deployment because the service exposes customer data.";
    const units = buildSummaryUnits(source);
    expect(units).toHaveLength(66);
    expect(selectStructuredSummary(units, units.map(() => [1, 0]), 80)).toContain("Cancel deployment");
  });

  it("deduplicates facts, respects budgets and safely handles missing/bad vectors", () => {
    const units = buildSummaryUnits("Repeated observation. Repeated observation. A distinct result.");
    for (const vectors of [undefined, [[1, 0]], [[NaN], [1], [1]]]) {
      const result = selectStructuredSummary(units, vectors, 20);
      expect(result.match(/Repeated observation/g)).toHaveLength(1);
      expect(result.split(/\s+/).length).toBeLessThanOrEqual(20);
      expect(result).not.toContain("NaN");
    }
  });

  it("returns empty input and marks unavoidable truncation of an oversized fact", () => {
    expect(summarizeStructured("")).toBe("");
    const result = summarizeStructured(Array.from({ length: 100 }, (_, i) => `word${i}`).join(" "), 20);
    expect(result.endsWith("…")).toBe(true);
    expect(result.split(/\s+/)).toHaveLength(20);
  });

  it("rejoins wrapped achievements without moving them into another section", () => {
    const units = buildSummaryUnits("ACHIEVEMENTS\nWon the annual regional competition and placed among the top five teams in the Coding\nChallenge (2025)\nPROJECTS\nAtlas\nBuilt a service.");
    expect(units[0].text).toContain("Coding Challenge (2025)");
    expect(units[1].context).toBe("Atlas");
  });
});
