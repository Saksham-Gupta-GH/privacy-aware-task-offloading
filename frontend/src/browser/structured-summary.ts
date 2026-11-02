import { splitSentences } from "./summarize";

export type SummaryUnit = { section: string; context: string; text: string };
const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const bulletRegex = /^[-*•⮚\u2B9A\u25B6\u2022\u25AA\u25B8\u2013\u2014]\s*|^\d+[.)]\s*/;
const action = /^(?:[-*•⮚\u2B9A\u25B6\u2022\u25AA\u25B8\u2013\u2014]\s*|\d+[.)]\s*)?(?:built|developed|designed|implemented|engineered|migrated|optimized|benchmarked|integrated|architected|performed|supported|led|managed|created|reduced|improved|delivered|achieved|maintained|deployed|tested|analyzed)\b/i;
const known = /^(?:education|(?:technical )?skills|(?:work |professional )?experience|projects|(?:open source )?contributions|achievements|certifications|additional|summary|introduction|background|methods?|results?|discussion|conclusions?|recommendations|limitations|about us|role details|job description|responsibilities|requirements|qualifications|key details|overview)$/i;
const tableKey = /^(Title|Job Location|Location|Cut-Off Criteria|Eligibility|Branches|Stipend|Salary|Compensation|Tentative Date of Joining|Date of Joining|Duration|Department|Industry)\b\s*[:\s]\s*(.*)$/i;
const metricBonus = /\d+(?:\.\d+)?\s*(?:%|×|x\b)|\b(?:CGPA|GPA|\$\d+|\d+\s*k)\b/i;
const clean = (s: string) => s.replace(/\((?:Live Link|GitLab|GitHub|Certificate)\)/gi, "").replace(/\s+/g, " ").trim();

const sectionName = (s: string) => {
  const title = s.replace(/^#{1,6}\s+/, "").replace(/:$/, "").trim();
  if (known.test(title)) return title;
  if (/^#{1,6}\s+/.test(s)) return title;
  if (s.endsWith(":") && countWords(s) <= 5 && !/[.!?]/.test(s.slice(0, -1))) return s.slice(0, -1).trim();
  if (countWords(title) <= 8 && /^[A-Z][A-Z &/-]+$/.test(title)) return title;
  return "";
};

/** Keep source context with facts. Generalized for arbitrary structured documents. */
export function buildSummaryUnits(content: string): SummaryUnit[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n").map(clean).filter(Boolean);
  const hasSections = lines.some((line) => Boolean(sectionName(line)));
  let section = hasSections ? "" : "Overview";
  let context = "";
  let awaitingEmployer = false;
  const units: SummaryUnit[] = [];

  for (const line of lines) {
    const heading = sectionName(line);
    const titleOnly = line.replace(/^#{1,6}\s+/, "").replace(/:$/, "").trim();
    if (!section && !known.test(titleOnly) && !/^#{1,6}\s+/.test(line) && !(line.endsWith(":") && countWords(line) <= 5)) {
      continue;
    }
    if (heading) {
      section = heading;
      context = "";
      awaitingEmployer = false;
      continue;
    }
    if (!section) continue;

    const tableMatch = line.match(tableKey);
    if (tableMatch) {
      const k = tableMatch[1].trim();
      const v = tableMatch[2].trim();
      if (v) {
        const targetSec = /skills/i.test(section) ? "Role Details" : section;
        units.push({ section: targetSec, context: k, text: v });
        continue;
      }
    }

    const isBullet = bulletRegex.test(line);
    const cleanText = line.replace(bulletRegex, "").trim();
    const experience = /experience/i.test(section);
    const education = /education/i.test(section);
    const projects = /projects/i.test(section);

    if (experience && !isBullet && !action.test(line) && /\b(?:intern|engineer|analyst|developer|manager|consultant|researcher)\b/i.test(line) && !/[.!?]$/.test(line)) {
      context = cleanText.replace(/\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}.*$/i, "").trim();
      awaitingEmployer = true;
      continue;
    }
    if (awaitingEmployer && !isBullet && !action.test(line) && !/[.!?]$/.test(line) && countWords(cleanText) <= 8) {
      context += ` — ${cleanText}`;
      awaitingEmployer = false;
      continue;
    }
    awaitingEmployer = false;

    const previous = units[units.length - 1];
    if (previous && previous.section === section && previous.context === context &&
        !/[.!?]$/.test(previous.text) && countWords(previous.text) > 12 &&
        (action.test(previous.text) || /achievements/i.test(section)) &&
        !action.test(line) && !/^[-*•⮚]|:|\|/.test(line)) {
      previous.text += ` ${line}`;
      continue;
    }

    if ((projects && !isBullet && !action.test(line) && countWords(cleanText) <= 8 && !/[.!?]$/.test(line)) ||
        (education && /\b(?:university|institute|college|school)\b/i.test(line))) {
      context = cleanText;
      continue;
    }

    const last = units[units.length - 1];
    const gpa = education ? line.match(/(?:CGPA|GPA):\s*[\d./]+/i)?.[0] : undefined;
    if (gpa && last?.context === context && last.section === section) {
      last.text += `; ${gpa}`;
      continue;
    }

    // Rejoin obvious continuation lines
    if (last && last.section === section && last.context === context && !/[.!?]$/.test(last.text) &&
        (/^[a-z0-9]/.test(cleanText) || /[,–-]$/.test(last.text))) {
      last.text += ` ${cleanText}`;
      continue;
    }

    for (const text of splitSentences(cleanText)) {
      if (text) units.push({ section, context, text });
    }
  }
  return units;
}

export const summaryEmbeddingText = (unit: SummaryUnit) => `${unit.section}. ${unit.context}. ${unit.text}`;

export function formatSummary(units: SummaryUnit[]): string {
  const sections = new Map<string, SummaryUnit[]>();
  for (const unit of units) sections.set(unit.section, [...(sections.get(unit.section) ?? []), unit]);
  return [...sections].map(([section, items]) => `## ${section}\n${items.map((item) =>
    `- ${item.context ? `${item.context}: ` : ""}${item.text}`).join("\n")}`).join("\n\n");
}

/** General-purpose MMR summarization with balanced section quotas and word budget. */
export function selectStructuredSummary(units: SummaryUnit[], embeddings?: number[][], wordBudget = 180): string {
  const budget = Math.max(20, Math.min(500, Math.floor(wordBudget)));
  if (!units.length) return "";
  const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);
  const norm = (v: number[]) => { const n = Math.sqrt(dot(v, v)) || 1; return v.map((x) => x / n); };
  const valid = embeddings?.length === units.length && embeddings[0]?.length && embeddings.every((v) => v.length === embeddings[0].length && v.every(Number.isFinite));
  const vectors = valid ? embeddings!.map(norm) : undefined;
  const centroid = vectors ? norm(vectors[0].map((_, d) => vectors.reduce((s, v) => s + v[d], 0) / vectors.length)) : undefined;

  const relevance = units.map((u, i) => (vectors ? dot(vectors[i], centroid!) : 0.5) +
    (metricBonus.test(u.text) ? 0.25 : 0));

  const chosen: number[] = [];
  const fingerprints = new Set<string>();
  const fingerprint = (u: SummaryUnit) => `${u.context}|${u.text}`.toLowerCase().replace(/\s+/g, " ");
  const render = (ids: number[]) => formatSummary([...ids].sort((a, b) => a - b).map((i) => units[i]));
  const fits = (i: number) => !chosen.includes(i) && !fingerprints.has(fingerprint(units[i])) && countWords(render([...chosen, i])) <= budget;

  const score = (i: number) => {
    const redundancy = vectors && chosen.length ? Math.max(...chosen.map((j) => dot(vectors[i], vectors[j]))) : 0;
    const sectionCount = chosen.filter((j) => units[j].section === units[i].section).length;
    const coverageBonus = sectionCount === 0 ? 0.15 : 0.0;
    const saturationPenalty = 0.08 * sectionCount;
    return 0.70 * relevance[i] - 0.30 * redundancy + coverageBonus - saturationPenalty;
  };

  const choose = (pool: number[]) => {
    const eligible = pool.filter(fits).sort((a, b) => score(b) - score(a) || a - b);
    if (!eligible.length) return false;
    chosen.push(eligible[0]);
    fingerprints.add(fingerprint(units[eligible[0]]));
    return true;
  };

  const ids = units.map((_, i) => i);
  const sections = [...new Set(units.map((u) => u.section))];

  // Pass 1 (Breadth): ensure broad coverage across every detected section
  for (const s of sections) {
    choose(ids.filter((i) => units[i].section === s));
  }

  // Pass 2 (Depth): fill remaining budget with best items from any section
  while (choose(ids)) { /* bounded by candidates and budget */ }

  if (chosen.length) return render(chosen);

  const excerpt = { ...units[0], section: units[0].section.split(/\s+/).slice(0, 5).join(" ") };
  if (countWords(excerpt.context) > budget / 3) excerpt.context = excerpt.context.split(/\s+/).slice(0, Math.floor(budget / 3) - 1).join(" ") + " …";
  const available = budget - countWords(formatSummary([{ ...excerpt, text: "" }])) - 1;
  excerpt.text = excerpt.text.split(/\s+/).slice(0, Math.max(1, available)).join(" ") + " …";
  return formatSummary([excerpt]);
}

export const summarizeStructured = (content: string, wordBudget = 180) =>
  selectStructuredSummary(buildSummaryUnits(content), undefined, wordBudget);
