const STOP_WORDS = new Set(
  "a an and are as at be been but by for from had has have he her hers him his i in into is it its me my of on or our ours she that the their them they this to was we were what when where which who will with you your".split(" "),
);

const words = (value: string) =>
  value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g)?.filter((word) => !STOP_WORDS.has(word)) ?? [];

export function splitSentences(content: string): string[] {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (typeof Intl.Segmenter !== "undefined") {
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    return Array.from(segmenter.segment(normalized), (entry) => entry.segment.trim()).filter(Boolean);
  }
  return normalized.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
}

export function summarizeExtractively(content: string, requestedSentences = 3): string {
  const sentences = splitSentences(content);
  if (sentences.length <= requestedSentences) return sentences.join(" ");

  const frequencies = new Map<string, number>();
  words(content).forEach((word) => frequencies.set(word, (frequencies.get(word) ?? 0) + 1));
  const ranked = sentences.map((sentence, index) => {
    const tokens = words(sentence);
    const rawScore = tokens.reduce((total, word) => total + (frequencies.get(word) ?? 0), 0);
    const lengthPenalty = Math.max(8, tokens.length);
    const positionBoost = index === 0 ? 1.12 : 1;
    return { sentence, index, score: (rawScore / lengthPenalty) * positionBoost };
  });

  return ranked
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.min(requestedSentences, sentences.length))
    .sort((left, right) => left.index - right.index)
    .map((item) => item.sentence)
    .join(" ");
}
