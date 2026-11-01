import { buildSearchPassages, selectSemanticSummary } from "./semantic";
import { splitSentences } from "./summarize";

export const BROWSER_MODEL = "onnx-community/all-MiniLM-L6-v2-ONNX";

type Progress = { status?: string; progress?: number; file?: string };
type ProgressHandler = (message: string) => void;
type Extractor = (
  texts: string | string[],
  options: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist(): unknown }>;

let extractorPromise: Promise<Extractor> | undefined;

const describeProgress = (update: Progress) => {
  if (typeof update.progress === "number") return `Loading MiniLM locally… ${Math.round(update.progress)}%`;
  if (update.status === "ready") return "MiniLM ready on this device";
  return "Loading MiniLM locally…";
};

async function getExtractor(onProgress?: ProgressHandler): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = import("@huggingface/transformers").then(async ({ env, pipeline }) => {
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      return pipeline("feature-extraction", BROWSER_MODEL, {
        dtype: "q4",
        progress_callback: (update: Progress) => onProgress?.(describeProgress(update)),
      }) as Promise<Extractor>;
    });
    extractorPromise.catch(() => { extractorPromise = undefined; });
  }
  return extractorPromise;
}

export async function embedTexts(texts: string[], onProgress?: ProgressHandler): Promise<number[][]> {
  if (!texts.length) return [];
  const extractor = await getExtractor(onProgress);
  const tensor = await extractor(texts, { pooling: "mean", normalize: true });
  return tensor.tolist() as number[][];
}

export async function createSearchIndex(content: string, onProgress?: ProgressHandler) {
  const passages = buildSearchPassages(content);
  const vectors = await embedTexts(passages, onProgress);
  return passages.map((text, index) => ({ text, embedding: vectors[index] }));
}

export async function summarizeWithMiniLM(
  content: string,
  requestedSentences = 3,
  onProgress?: ProgressHandler,
): Promise<string> {
  const sentences = splitSentences(content).slice(0, 48);
  if (sentences.length <= requestedSentences) return sentences.join(" ");
  const vectors = await embedTexts(sentences, onProgress);
  return selectSemanticSummary(content, vectors, requestedSentences);
}
