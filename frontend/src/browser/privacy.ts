import { BrowserClassification, Sensitivity } from "./types";

const EMAIL = /(?<![\w.+-])([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})(?![\w.-])/gi;
const PHONE = /(?<!\d)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?!\d)/g;
const LONG_DIGITS = /(?<!\d)(?:\d[\s-]?){12,18}\d(?!\d)/g;
const CONFIDENTIAL = ["strictly confidential", "confidential document", "do not distribute", "restricted access"];
const PAYMENT = ["credit card", "card number", "payment card", "debit card", "expiry", "cvv", "billing"];
const ORDER = ["order number", "order id", "reference number", "tracking number", "invoice number"];
const HEALTH = ["patient", "diagnosis", "medical record", "prescription", "treatment"];
const IDENTITY = ["patient name", "date of birth", "dob", "email", "phone"];
const PUBLIC_CONTACT = ["public contact", "published contact", "public directory", "public information"];
const PERSONAL_MARKERS = ["personal data", "private contact", "personal contact"];

const includesAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));

const nearPublicMarker = (text: string, start: number, end: number) =>
  includesAny(text.slice(Math.max(0, start - 100), Math.min(text.length, end + 100)).toLowerCase(), PUBLIC_CONTACT);

const luhnValid = (digits: string) => {
  if (digits.length < 13 || digits.length > 19 || new Set(digits).size === 1) return false;
  const parity = digits.length % 2;
  const sum = [...digits].reduce((total, character, index) => {
    let value = Number(character);
    if (index % 2 === parity) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    return total + value;
  }, 0);
  return sum % 10 === 0;
};

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
  const severities = new Set<Sensitivity>();

  if (!normalized) {
    severities.add("uncertain");
    reasons.push("No readable text was found, so the document stays local for review.");
    return { sensitivity: "uncertain", reasons, ...policy.uncertain };
  }

  if (includesAny(normalized, CONFIDENTIAL)) {
    severities.add("restricted");
    reasons.push("An explicit confidentiality or restricted-access marker was detected.");
  }

  const paymentContext = includesAny(normalized, PAYMENT);
  const orderContext = includesAny(normalized, ORDER);
  const occupiedDigitRanges: Array<[number, number]> = [];
  for (const match of content.matchAll(LONG_DIGITS)) {
    const start = match.index;
    const end = start + match[0].length;
    occupiedDigitRanges.push([start, end]);
    const digits = match[0].replace(/\D/g, "");
    if (orderContext && !paymentContext) continue;
    if (paymentContext && luhnValid(digits)) {
      severities.add("restricted");
      reasons.push("A Luhn-valid card-like number appeared with payment context.");
    } else {
      severities.add("uncertain");
      reasons.push("A long digit sequence could not be classified safely.");
    }
  }

  let privateIdentity = false;
  for (const match of content.matchAll(EMAIL)) {
    if (!nearPublicMarker(content, match.index, match.index + match[0].length)) {
      privateIdentity = true;
      severities.add("personal");
      reasons.push("A private or unlabelled email address was detected.");
    }
  }
  for (const match of content.matchAll(PHONE)) {
    const start = match.index;
    const end = start + match[0].length;
    if (occupiedDigitRanges.some(([left, right]) => left <= start && end <= right)) continue;
    if (!nearPublicMarker(content, start, end)) {
      privateIdentity = true;
      severities.add("personal");
      reasons.push("A private or unlabelled phone number was detected.");
    }
  }
  if (includesAny(normalized, PERSONAL_MARKERS)) {
    privateIdentity = true;
    severities.add("personal");
    reasons.push("The document explicitly identifies its contents as personal data.");
  }
  if (includesAny(normalized, HEALTH) && (privateIdentity || includesAny(normalized, IDENTITY))) {
    severities.add("restricted");
    reasons.push("Health information is linked to an identity signal.");
  }

  const sensitivity: Sensitivity = (["restricted", "uncertain", "personal"] as Sensitivity[])
    .find((candidate) => severities.has(candidate)) ?? "public";
  if (sensitivity === "public") reasons.push("No blocking privacy signal was detected.");

  return { sensitivity, reasons, ...policy[sensitivity] };
}
