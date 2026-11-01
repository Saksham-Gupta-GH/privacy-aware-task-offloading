import { BrowserClassification, Sensitivity } from "./types";

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/;
const LONG_DIGITS = /(?:\d[\s-]?){13,19}/;
const CONFIDENTIAL = ["strictly confidential", "confidential document", "do not distribute", "restricted access"];
const PAYMENT = ["credit card", "card number", "payment card", "debit card", "expiry", "cvv", "billing"];
const ORDER = ["order number", "order id", "reference number", "tracking number", "invoice number"];
const HEALTH = ["patient", "diagnosis", "medical record", "prescription", "treatment"];
const IDENTITY = ["patient name", "date of birth", "dob", "email", "phone"];
const PUBLIC_CONTACT = ["public contact", "published contact", "public directory", "public information"];

const includesAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));

const policy: Record<Sensitivity, Omit<BrowserClassification, "sensitivity" | "reasons">> = {
  public: {
    displayName: "Public",
    allowedDestinations: ["local", "edge", "cloud"],
    manualReviewRequired: false,
    policyVersion: "privacy-policy-v1",
  },
  personal: {
    displayName: "Personal",
    allowedDestinations: ["local", "edge"],
    manualReviewRequired: false,
    policyVersion: "privacy-policy-v1",
  },
  restricted: {
    displayName: "Restricted",
    allowedDestinations: ["local"],
    manualReviewRequired: false,
    policyVersion: "privacy-policy-v1",
  },
  uncertain: {
    displayName: "Uncertain",
    allowedDestinations: ["local"],
    manualReviewRequired: true,
    policyVersion: "privacy-policy-v1",
  },
};

export function classifyInBrowser(content: string): BrowserClassification {
  const normalized = content.toLowerCase().replace(/\s+/g, " ").trim();
  const reasons: string[] = [];
  let sensitivity: Sensitivity = "public";

  if (!normalized) {
    sensitivity = "uncertain";
    reasons.push("No readable text was found, so the document stays local for review.");
  } else if (includesAny(normalized, CONFIDENTIAL)) {
    sensitivity = "restricted";
    reasons.push("An explicit confidentiality or restricted-access marker was detected.");
  } else if (includesAny(normalized, HEALTH) && (includesAny(normalized, IDENTITY) || EMAIL.test(content))) {
    sensitivity = "restricted";
    reasons.push("Health information is linked to an identity signal.");
  } else if (includesAny(normalized, PAYMENT) && LONG_DIGITS.test(content)) {
    sensitivity = "restricted";
    reasons.push("Payment context and a card-like number were detected.");
  } else if (LONG_DIGITS.test(content) && !includesAny(normalized, ORDER)) {
    sensitivity = "uncertain";
    reasons.push("A card-like number was found without enough context for a safe classification.");
  } else if ((EMAIL.test(content) || PHONE.test(content)) && !includesAny(normalized, PUBLIC_CONTACT)) {
    sensitivity = "personal";
    reasons.push("A private or unlabelled contact identifier was detected.");
  } else {
    reasons.push("No blocking privacy signal was detected.");
  }

  return { sensitivity, reasons, ...policy[sensitivity] };
}
