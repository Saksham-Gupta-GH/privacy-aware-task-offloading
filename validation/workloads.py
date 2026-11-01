"""Deterministic synthetic workloads shared by all benchmark runtimes."""

from __future__ import annotations

import random


DEFAULT_SEED = 20261101
CASES = {
    "small": (1, 1),
    "long": (1, 32),
    "batch": (16, 32),
}


def synthetic_passages(documents: int, passages_per_document: int, seed: int) -> list[str]:
    rng = random.Random(seed)
    topics = [
        "campus sustainability and renewable energy planning",
        "public transport schedules and commuter experience",
        "software testing practices for distributed systems",
        "library digitization and semantic document retrieval",
        "weather observations and agricultural planning",
        "student clubs organizing public technical workshops",
    ]
    passages: list[str] = []
    for document_index in range(documents):
        topic = topics[document_index % len(topics)]
        for passage_index in range(passages_per_document):
            observations = rng.sample(topics, k=3)
            sentence = (
                f"Synthetic document {document_index}, passage {passage_index}, discusses {topic}. "
                f"It compares {observations[0]}, {observations[1]}, and {observations[2]}. "
                "The material is fictional and contains no personal or confidential information. "
            )
            passages.append(sentence * 6)
    return passages

