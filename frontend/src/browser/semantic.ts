import { splitSentences } from "./summarize";

export const dot = (left: number[], right: number[]) =>
  left.reduce((total, value, index) => total + value * (right[index] ?? 0), 0);

const normalized = (vector: number[]) => {
  const magnitude = Math.sqrt(dot(vector, vector)) || 1;
  return vector.map((value) => value / magnitude);
};

export function buildSearchPassages(content: string, wordsPerPassage = 110): string[] {
  const paragraphs = content.split(/\n{2,}/).map((value) => value.trim()).filter(Boolean);
  const source = paragraphs.length > 1 ? paragraphs : [content.trim()];
  const passages: string[] = [];
  for (const paragraph of source) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    for (let index = 0; index < words.length; index += wordsPerPassage) {
      passages.push(words.slice(index, index + wordsPerPassage).join(" "));
    }
  }
  return passages.filter(Boolean).slice(0, 40);
}

export function selectSemanticSummary(
  content: string,
  embeddings: number[][],
  requestedSentences = 3,
): string {
  const sentences = splitSentences(content).slice(0, 48);
  if (sentences.length <= requestedSentences || embeddings.length !== sentences.length) {
    return sentences.join(" ");
  }
  const vectors = embeddings.map(normalized);
  const centroid = normalized(
    vectors[0].map((_, dimension) =>
      vectors.reduce((total, vector) => total + vector[dimension], 0) / vectors.length,
    ),
  );
  const relevance = vectors.map((vector, index) => dot(vector, centroid) + (index === 0 ? 0.04 : 0));
  const selected: number[] = [];
  while (selected.length < Math.min(requestedSentences, sentences.length)) {
    let winner = -1;
    let winnerScore = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < sentences.length; index += 1) {
      if (selected.includes(index)) continue;
      const redundancy = selected.length
        ? Math.max(...selected.map((chosen) => dot(vectors[index], vectors[chosen])))
        : 0;
      const score = 0.72 * relevance[index] - 0.28 * redundancy;
      if (score > winnerScore) {
        winner = index;
        winnerScore = score;
      }
    }
    if (winner < 0) break;
    selected.push(winner);
  }
  return selected.sort((left, right) => left - right).map((index) => sentences[index]).join(" ");
}
