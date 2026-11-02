const STOP_WORDS = new Set(
  "a an and are as at be been but by for from had has have he her hers him his i in into is it its me my of on or our ours she that the their them they this to was we were what when where which who will with you your".split(" "),
);

const words = (value: string) =>
  value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g)?.filter((word) => !STOP_WORDS.has(word)) ?? [];

export function splitSentences(content: string): string[] {
  // Lines are structural boundaries for PDFs, headings and lists. Never flatten
  // them before segmentation or discard short headings. Keep Python in sync.
  const units: string[] = [];
  const abbreviation = /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|e\.g|i\.e)|\b(?:[A-Za-z]\.)*[A-Za-z])\.$/i;
  for (const line of content.replace(/\r\n?/g, "\n").split(/\n+/)) {
    const normalized = line.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    let pending = "";
    for (const part of normalized.split(/(?<=[.!?])\s+/)) {
      pending += `${pending ? " " : ""}${part}`;
      if (abbreviation.test(pending) || /^\d+\.$/.test(pending)) continue;
      units.push(pending);
      pending = "";
    }
    if (pending) units.push(pending);
  }
  return units;
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
