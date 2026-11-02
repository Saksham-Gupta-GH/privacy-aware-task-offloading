export type Sensitivity = "public" | "personal" | "restricted" | "uncertain";

export type BrowserClassification = {
  sensitivity: Sensitivity;
  displayName: string;
  allowedDestinations: Array<"local" | "edge" | "cloud">;
  reasons: string[];
  manualReviewRequired: boolean;
  policyVersion: "privacy-policy-v1";
};

export type BrowserDocument = {
  id: string;
  ownerId: string;
  name: string;
  mediaType: "text/plain" | "application/pdf";
  content: string;
  classification: BrowserClassification;
  createdAt: number;
  summary?: string;
  summaryTier?: "local" | "edge" | "cloud";
  receipt?: Record<string, unknown>;
  searchPassages?: Array<{ text: string; embedding: number[] }>;
  embeddingModel?: "all-MiniLM-L6-v2";
  searchIndexVersion?: 2;
};

export type BrowserSearchResult = {
  documentId: string;
  name: string;
  sensitivity: Sensitivity;
  score: number;
  matchingPassage: string;
};
