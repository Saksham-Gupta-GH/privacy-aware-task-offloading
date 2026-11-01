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
  name: string;
  mediaType: "text/plain" | "application/pdf";
  content: string;
  classification: BrowserClassification;
  createdAt: number;
  summary?: string;
};
