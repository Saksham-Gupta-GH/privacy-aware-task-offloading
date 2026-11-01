"""Deterministic extractive summarization shared by execution workers."""

from __future__ import annotations

import re
from collections import Counter

import numpy as np


SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+")
TOKEN = re.compile(r"[a-z0-9][a-z0-9'-]*", re.I)
STOP_WORDS = frozenset(
    "a an and are as at be been but by for from had has have he her hers him his i in "
    "into is it its me my of on or our ours she that the their them they this to was we "
    "were what when where which who will with you your".split()
)


def split_sentences(content: str) -> list[str]:
    cleaned = content.replace("\r", "").strip()
    normalized = " ".join(cleaned.split())
    sentences = [sentence.strip() for sentence in SENTENCE_BOUNDARY.split(normalized) if sentence.strip()]
    if len(sentences) > 1:
        return sentences
    lines = [line.strip() for line in cleaned.splitlines() if len(line.strip()) > 20]
    if len(lines) > 1:
        return lines
    words = normalized.split()
    return [" ".join(words[start : start + 35]) for start in range(0, len(words), 35)]


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


def summarize_semantically(
    content: str,
    embeddings: np.ndarray,
    sentence_count: int = 3,
) -> str:
    """Select central, non-redundant original sentences using MiniLM and MMR."""
    sentences = split_sentences(content)[:48]
    requested = max(1, sentence_count)
    vectors = np.asarray(embeddings, dtype=np.float32)
    if len(sentences) <= requested or vectors.shape[0] != len(sentences):
        return " ".join(sentences)
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    vectors = vectors / np.maximum(norms, 1e-8)
    centroid = vectors.mean(axis=0)
    centroid = centroid / max(float(np.linalg.norm(centroid)), 1e-8)
    relevance = vectors @ centroid
    relevance[0] += 0.04
    selected: list[int] = []
    while len(selected) < min(requested, len(sentences)):
        best_index = -1
        best_score = float("-inf")
        for index in range(len(sentences)):
            if index in selected:
                continue
            redundancy = max((float(vectors[index] @ vectors[item]) for item in selected), default=0.0)
            score = 0.72 * float(relevance[index]) - 0.28 * redundancy
            if score > best_score:
                best_index, best_score = index, score
        if best_index < 0:
            break
        selected.append(best_index)
    return " ".join(sentences[index] for index in sorted(selected))
