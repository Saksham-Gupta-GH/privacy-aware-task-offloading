import { splitSentences } from "./summarize";

export const dot = (left: number[], right: number[]) =>
  left.reduce((total, value, index) => total + value * (right[index] ?? 0), 0);

const normalized = (vector: number[]) => {
  const magnitude = Math.sqrt(dot(vector, vector)) || 1;
  return vector.map((value) => value / magnitude);
};

const SEARCH_STOPWORDS = new Set(
  "a an and are as at be by for from in is it of on or that the this to was were what when where which who with".split(" "),
);

const searchTokens = (value: string): string[] =>
  (value.normalize("NFKD").toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((token) => token.length > 1 && !SEARCH_STOPWORDS.has(token))
    .map((token) => {
      if (token.length > 6 && token.endsWith("ing")) return token.slice(0, -3);
      if (token.length > 5 && token.endsWith("ed")) return token.slice(0, -2);
      if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
      return token;
    });

export type HybridSearchDocument = {
  id: string;
  name: string;
  passages: Array<{ text: string; embedding: number[] }>;
};

export type HybridSearchHit = {
  documentId: string;
  score: number;
  matchingPassage: string;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function rankHybridSearch(
  query: string,
  queryEmbedding: number[],
  documents: HybridSearchDocument[],
): HybridSearchHit[] {
  const queryTerms = [...new Set(searchTokens(query))];
  const allPassages = documents.flatMap((document) => document.passages.map((passage) => ({
    documentId: document.id,
    documentName: document.name,
    ...passage,
    tokens: searchTokens(passage.text),
  })));
  if (!allPassages.length) return [];

  const averageLength = allPassages.reduce((total, passage) => total + passage.tokens.length, 0) / allPassages.length || 1;
  const documentFrequency = new Map<string, number>();
  for (const term of queryTerms) {
    documentFrequency.set(term, allPassages.filter((passage) => passage.tokens.includes(term)).length);
  }

  const passageScores = allPassages.map((passage) => {
    const frequencies = new Map<string, number>();
    passage.tokens.forEach((token) => frequencies.set(token, (frequencies.get(token) ?? 0) + 1));
    const bm25 = queryTerms.reduce((total, term) => {
      const frequency = frequencies.get(term) ?? 0;
      if (!frequency) return total;
      const frequencyInCorpus = documentFrequency.get(term) ?? 0;
      const inverseFrequency = Math.log(1 + (allPassages.length - frequencyInCorpus + 0.5) / (frequencyInCorpus + 0.5));
      const denominator = frequency + 1.2 * (1 - 0.75 + 0.75 * passage.tokens.length / averageLength);
      return total + inverseFrequency * (frequency * 2.2 / denominator);
    }, 0);
    const lexical = 1 - Math.exp(-bm25 / 2.5);
    const semantic = clamp01((dot(queryEmbedding, passage.embedding) - 0.05) / 0.75);
    const normalizedQuery = queryTerms.join(" ");
    const normalizedPassage = passage.tokens.join(" ");
    const phrase = normalizedQuery.length > 2 && normalizedPassage.includes(normalizedQuery) ? 1 : 0;
    const filenameTokens = new Set(searchTokens(passage.documentName));
    const filenameCoverage = queryTerms.length
      ? queryTerms.filter((term) => filenameTokens.has(term)).length / queryTerms.length
      : 0;
    const rankingScore = 0.70 * semantic + 0.23 * lexical + 0.04 * phrase + 0.03 * filenameCoverage;
    return { ...passage, rankingScore };
  });

  return documents.map((document) => {
    const best = passageScores
      .filter((passage) => passage.documentId === document.id)
      .sort((left, right) => right.rankingScore - left.rankingScore)[0];
    return {
      documentId: document.id,
      score: Math.round(clamp01(best.rankingScore) * 100),
      matchingPassage: best.text,
    };
  }).sort((left, right) => right.score - left.score);
}

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

export function buildSearchPassages(content: string, wordsPerPassage = 110, overlapWords = 25): string[] {
  const paragraphs = content.split(/\n{2,}/).map((value) => value.trim()).filter(Boolean);
  const source = paragraphs.length > 1 ? paragraphs : [content.trim()];
  const passages: string[] = [];
  for (const paragraph of source) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    const step = Math.max(1, wordsPerPassage - Math.min(overlapWords, wordsPerPassage - 1));
    for (let index = 0; index < words.length; index += step) {
      passages.push(words.slice(index, index + wordsPerPassage).join(" "));
      if (index + wordsPerPassage >= words.length) break;
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
