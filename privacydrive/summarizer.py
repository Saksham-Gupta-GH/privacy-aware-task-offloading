"""Deterministic extractive summarization shared by execution workers."""

from __future__ import annotations

import re
from collections import Counter


SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+")
TOKEN = re.compile(r"[a-z0-9][a-z0-9'-]*", re.I)
STOP_WORDS = frozenset(
    "a an and are as at be been but by for from had has have he her hers him his i in "
    "into is it its me my of on or our ours she that the their them they this to was we "
    "were what when where which who will with you your".split()
)


def split_sentences(content: str) -> list[str]:
    normalized = " ".join(content.split())
    return [sentence.strip() for sentence in SENTENCE_BOUNDARY.split(normalized) if sentence.strip()]


def _words(value: str) -> list[str]:
    return [word.lower() for word in TOKEN.findall(value) if word.lower() not in STOP_WORDS]


def summarize_extractively(content: str, sentence_count: int = 3) -> str:
    """Select important original sentences without generating new document content."""
    sentences = split_sentences(content)
    requested = max(1, sentence_count)
    if len(sentences) <= requested:
        return " ".join(sentences)
    frequencies = Counter(_words(content))
    ranked: list[tuple[float, int, str]] = []
    for index, sentence in enumerate(sentences):
        tokens = _words(sentence)
        raw_score = sum(frequencies[token] for token in tokens)
        score = raw_score / max(8, len(tokens))
        if index == 0:
            score *= 1.12
        ranked.append((score, index, sentence))
    selected = sorted(sorted(ranked, reverse=True)[:requested], key=lambda item: item[1])
    return " ".join(item[2] for item in selected)
