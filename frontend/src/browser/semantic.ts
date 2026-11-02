import { splitSentences } from "./summarize";

export const dot = (left: number[], right: number[]) =>
  left.reduce((total, value, index) => total + value * (right[index] ?? 0), 0);

const normalized = (vector: number[]) => {
  const magnitude = Math.sqrt(dot(vector, vector)) || 1;
  return vector.map((value) => value / magnitude);
};

export const calibrateScore = (cosine: number, query: string, text: string): number => {
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const normalizedCosine = Math.max(0, Math.min(1, (cosine - 0.15) / 0.42));
  let score = 45 + normalizedCosine * 48; // 45% to 93%
  const lowerText = text.toLowerCase();
  const matchedTokens = tokens.filter((t) => lowerText.includes(t));
  if (tokens.length > 0 && matchedTokens.length > 0) {
    score += (matchedTokens.length / tokens.length) * 6; // up to +6% keyword boost
  }
  return Math.min(99, Math.max(15, Math.round(score)));
};

export function extractKeyTags(content: string): string[] {
  const stopwords = new Set([
    "the", "and", "this", "that", "with", "from", "for", "have", "been", "event",
    "will", "about", "student", "candidate", "available", "studies", "experience",
  ]);
  const words = content.match(/[A-Z][a-zA-Z0-9'-]*/g) || [];
  const freq = new Map<string, number>();
  for (const w of words) {
    const clean = w.trim();
    if (clean.length > 2 && !stopwords.has(clean.toLowerCase())) {
      freq.set(clean, (freq.get(clean) || 0) + 1);
    }
  }
  const sorted = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
  const tags = sorted.slice(0, 5).map(([w]) => w);
  if (!tags.length) {
    if (content.toLowerCase().includes("azure")) tags.push("Azure Cloud");
    if (content.toLowerCase().includes("edge")) tags.push("Edge Computing");
    if (content.toLowerCase().includes("payment")) tags.push("Financial Record");
    if (content.toLowerCase().includes("resume")) tags.push("Candidate Profile");
  }
  return tags.slice(0, 4);
}

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
  return selected
    .sort((left, right) => left - right)
    .map((index) => sentences[index])
    .join(" ");
}
