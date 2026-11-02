"""Context-preserving, budgeted extraction; kept in sync with structured-summary.ts."""
from __future__ import annotations

import math
import re
from typing import TypedDict

from .summarizer import split_sentences


class SummaryUnit(TypedDict):
    section: str
    context: str
    text: str


BULLET = re.compile(r"^[-*•⮚\u2B9A\u25B6\u2022\u25AA\u25B8\u2013\u2014]\s*|^\d+[.)]\s*")
ACTION = re.compile(r"^(?:[-*•⮚\u2B9A\u25B6\u2022\u25AA\u25B8\u2013\u2014]\s*|\d+[.)]\s*)?(?:built|developed|designed|implemented|engineered|migrated|optimized|benchmarked|integrated|architected|performed|supported|led|managed|created|reduced|improved|delivered|achieved|maintained|deployed|tested|analyzed)\b", re.I)
KNOWN = re.compile(r"^(?:education|(?:technical )?skills|(?:work |professional )?experience|projects|(?:open source )?contributions|achievements|certifications|additional|summary|introduction|background|methods?|results?|discussion|conclusions?|recommendations|limitations|about us|role details|job description|responsibilities|requirements|qualifications|key details|overview)$", re.I)
TABLE_KEY = re.compile(r"^(Title|Job Location|Location|Cut-Off Criteria|Eligibility|Branches|Stipend|Salary|Compensation|Tentative Date of Joining|Date of Joining|Duration|Department|Industry)\b\s*[:\s]\s*(.*)$", re.I)
METRIC_BONUS = re.compile(r"\d+(?:\.\d+)?\s*(?:%|\u00D7|x\b)|\b(?:CGPA|GPA|\$\d+|\d+\s*k)\b", re.I)


def _count(text: str) -> int:
    return len(text.split())


def _section_name(line: str) -> str:
    trimmed = line.strip()
    title = re.sub(r"^#{1,6}\s+", "", trimmed).removesuffix(":").strip()
    if KNOWN.fullmatch(title):
        return title
    if re.match(r"^#{1,6}\s+", trimmed):
        return title
    if trimmed.endswith(":") and len(trimmed.split()) <= 5 and not re.search(r"[.!?]", trimmed[:-1]):
        return trimmed[:-1].strip()
    if _count(title) <= 8 and re.fullmatch(r"[A-Z][A-Z &/-]+", title):
        return title
    return ""


def build_summary_units(content: str) -> list[SummaryUnit]:
    raw_lines = [" ".join(re.sub(r"\((?:Live Link|GitLab|GitHub|Certificate)\)", "", line, flags=re.I).split()) for line in content.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    lines = [line for line in raw_lines if line]

    has_sections = any(bool(_section_name(line)) for line in lines)
    section = "" if has_sections else "Overview"
    context = ""
    awaiting_employer = False
    units: list[SummaryUnit] = []

    for line in lines:
        heading = _section_name(line)
        title_only = re.sub(r"^#{1,6}\s+", "", line).removesuffix(":").strip()
        if not section and not KNOWN.fullmatch(title_only) and not re.match(r"^#{1,6}\s+", line) and not (line.endswith(":") and len(line.split()) <= 5):
            continue
        if heading:
            section, context, awaiting_employer = heading, "", False
            continue
        if not section:
            continue

        table_m = TABLE_KEY.match(line)
        if table_m:
            k = table_m.group(1).strip()
            v = table_m.group(2).strip()
            if v:
                target_sec = "Role Details" if re.search(r"skills", section, re.I) else section
                units.append(SummaryUnit(section=target_sec, context=k, text=v))
                continue

        is_bullet = bool(BULLET.match(line))
        clean_text = BULLET.sub("", line).strip()
        experience, education, projects = (word in section.lower() for word in ("experience", "education", "projects"))

        if experience and not is_bullet and not ACTION.match(line) and re.search(r"\b(?:intern|engineer|analyst|developer|manager|consultant|researcher)\b", line, re.I) and not re.search(r"[.!?]$", line):
            context, awaiting_employer = re.sub(r"\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}.*$", "", clean_text, flags=re.I).strip(), True
            continue
        if awaiting_employer and not is_bullet and not ACTION.match(line) and not re.search(r"[.!?]$", line) and _count(clean_text) <= 8:
            context += " — " + clean_text
            awaiting_employer = False
            continue
        awaiting_employer = False

        previous = units[-1] if units else None
        if previous and previous["section"] == section and previous["context"] == context and not re.search(r"[.!?]$", previous["text"]) and _count(previous["text"]) > 12 and (ACTION.match(previous["text"]) or "achievements" in section.lower()) and not ACTION.match(line) and not re.search(r"^[-*•⮚]|:|\|", line):
            previous["text"] += " " + line
            continue

        if ((projects and not is_bullet and not ACTION.match(line) and _count(clean_text) <= 8 and not re.search(r"[.!?]$", line)) or
            (education and re.search(r"\b(?:university|institute|college|school)\b", line, re.I))):
            context = clean_text
            continue

        last = units[-1] if units else None
        gpa = re.search(r"(?:CGPA|GPA):\s*[\d./]+", line, re.I) if education else None
        if gpa and last and last["context"] == context and last["section"] == section:
            last["text"] += "; " + gpa[0]
            continue

        if last and last["section"] == section and last["context"] == context and not re.search(r"[.!?]$", last["text"]) and (re.match(r"^[a-z0-9]", clean_text) or re.search(r"[,–-]$", last["text"])):
            last["text"] += " " + clean_text
            continue

        units.extend(SummaryUnit(section=section, context=context, text=text) for text in split_sentences(clean_text) if text)

    return units


def summary_embedding_text(unit: SummaryUnit) -> str:
    return f"{unit['section']}. {unit['context']}. {unit['text']}"


def format_summary(units: list[SummaryUnit]) -> str:
    sections: dict[str, list[SummaryUnit]] = {}
    for unit in units:
        sections.setdefault(unit["section"], []).append(unit)
    return "\n\n".join("## " + section + "\n" + "\n".join("- " + (unit["context"] + ": " if unit["context"] else "") + unit["text"] for unit in items) for section, items in sections.items())


def select_structured_summary(units: list[SummaryUnit], embeddings=None, word_budget: int = 180) -> str:
    budget = max(20, min(500, int(word_budget)))
    if not units:
        return ""

    def dot(a, b):
        return sum(x * y for x, y in zip(a, b))

    def norm(v):
        magnitude = math.sqrt(dot(v, v)) or 1
        return [x / magnitude for x in v]

    raw = embeddings.tolist() if hasattr(embeddings, "tolist") else embeddings
    valid = raw is not None and len(raw) == len(units) and len(raw[0]) > 0 and all(len(v) == len(raw[0]) and all(math.isfinite(x) for x in v) for v in raw)
    vectors = [norm(v) for v in raw] if valid else None
    centroid = norm([sum(v[d] for v in vectors) / len(vectors) for d in range(len(vectors[0]))]) if vectors else None

    relevance = [(dot(vectors[i], centroid) if vectors else 0.5) + (0.25 if METRIC_BONUS.search(u["text"]) else 0) for i, u in enumerate(units)]
    chosen: list[int] = []
    fingerprints: set[str] = set()

    def fingerprint(u):
        return " ".join((u["context"] + "|" + u["text"]).lower().split())

    def render(ids):
        return format_summary([units[i] for i in sorted(ids)])

    def fits(i):
        return i not in chosen and fingerprint(units[i]) not in fingerprints and _count(render([*chosen, i])) <= budget

    def score(i):
        redundancy = max(dot(vectors[i], vectors[j]) for j in chosen) if vectors and chosen else 0
        section_count = sum(1 for j in chosen if units[j]["section"] == units[i]["section"])
        coverage_bonus = 0.15 if section_count == 0 else 0.0
        saturation_penalty = 0.08 * section_count
        return 0.70 * relevance[i] - 0.30 * redundancy + coverage_bonus - saturation_penalty

    def choose(pool):
        eligible = sorted((i for i in pool if fits(i)), key=lambda i: (-score(i), i))
        if not eligible:
            return False
        chosen.append(eligible[0])
        fingerprints.add(fingerprint(units[eligible[0]]))
        return True

    ids = list(range(len(units)))
    sections = list(dict.fromkeys(u["section"] for u in units))

    # Pass 1: Ensure broad coverage by picking the best candidate for each section
    for s in sections:
        choose([i for i in ids if units[i]["section"] == s])

    # Pass 2: Fill remaining budget with highest MMR-scoring candidates across any section
    while choose(ids):
        pass

    if chosen:
        return render(chosen)

    excerpt = dict(units[0])
    excerpt["section"] = " ".join(excerpt["section"].split()[:5])
    if _count(excerpt["context"]) > budget / 3:
        excerpt["context"] = " ".join(excerpt["context"].split()[:budget // 3 - 1]) + " …"
    available = budget - _count(format_summary([{**excerpt, "text": ""}])) - 1
    excerpt["text"] = " ".join(excerpt["text"].split()[:max(1, available)]) + " …"
    return format_summary([excerpt])
