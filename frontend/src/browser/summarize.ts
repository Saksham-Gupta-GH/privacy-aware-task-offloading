const STOP_WORDS = new Set(
  "a an and are as at be been but by for from had has have he her hers him his i in into is it its me my of on or our ours she that the their them they this to was we were what when where which who will with you your".split(" "),
);

const words = (value: string) =>
  value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g)?.filter((word) => !STOP_WORDS.has(word)) ?? [];

export function splitSentences(content: string): string[] {
  const cleaned = content.replace(/\r/g, "").trim();
  if (!cleaned) return [];
  const normalized = cleaned.replace(/\s+/g, " ");
  if (typeof Intl.Segmenter !== "undefined") {
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    const segmented = Array.from(segmenter.segment(normalized), (entry) => entry.segment.trim()).filter(Boolean);
    if (segmented.length > 1) return segmented;
  }
  const punctuationSplit = normalized.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  if (punctuationSplit.length > 1) return punctuationSplit;
  const lines = cleaned.split(/\n+/).map((line) => line.trim()).filter((line) => line.length > 20);
  if (lines.length > 1) return lines;
  const tokens = normalized.split(/\s+/);
  return Array.from({ length: Math.ceil(tokens.length / 35) }, (_, index) =>
    tokens.slice(index * 35, (index + 1) * 35).join(" "),
  ).filter(Boolean);
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
