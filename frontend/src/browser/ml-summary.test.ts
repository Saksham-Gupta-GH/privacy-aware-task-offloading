import { expect, it, vi } from "vitest";
const { extractor } = vi.hoisted(() => ({ extractor: vi.fn(async (texts: string[]) => ({ tolist: () => texts.map(() => [1, 0]) })) }));
vi.mock("@huggingface/transformers", () => ({ env: {}, pipeline: vi.fn(async () => extractor) }));
import { summarizeWithMiniLM } from "./ml";

it("embeds all summary units in bounded batches and includes the final section", async () => {
  const content = "BACKGROUND\n" + Array.from({ length: 65 }, (_, i) => `Routine observation ${i}.`).join("\n") + "\nCONCLUSION\nStop the deployment because the test failed.";
  const result = await summarizeWithMiniLM(content, 80);
  expect(extractor.mock.calls).toHaveLength(5);
  expect(extractor.mock.calls.every(([texts]) => texts.length <= 16)).toBe(true);
  expect(extractor.mock.calls.reduce((n, [texts]) => n + texts.length, 0)).toBe(66);
  expect(result).toContain("Stop the deployment");
});
