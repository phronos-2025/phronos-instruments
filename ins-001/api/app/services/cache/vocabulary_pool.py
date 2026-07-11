"""
VocabularyPool - Static vocabulary artifact, memory-mapped

Owns the entire vocabulary: words, embeddings, and nearest-neighbour search.
Replaces the `vocabulary_embeddings` Postgres table and the pgvector RPCs
(`get_noise_floor_by_embedding`, `get_statistical_union`), which together made up
~430 MB of a 500 MB Free-tier budget.

The matrix is loaded with mmap_mode='r', so pages are faulted in on demand and
managed by the OS page cache rather than the Python heap.

Search is exact. The pgvector index it replaces was an approximate ivfflat scan
(lists=100), so nearest-neighbour results differ from the pre-migration ones.
See scripts/parity_check.py and INS-001-DECISION-HISTORY.md.

Embeddings are unit-normalised at export time (asserted by
scripts/export_vocab_artifact.py), so cosine similarity is a plain dot product.

Artifact layout (VOCAB_ARTIFACT_DIR):
    vocab_words.json        ordered word list; index i <-> row i
    vocab_embeddings.npy    float32 (N, 1536)
    vocab_meta.json         count, dims, dtype, sha256

Usage:
    pool = VocabularyPool.get_instance()
    pool.initialize()                      # blocking, at startup

    pool.get_random()                      # instant random word
    pool.nearest(query_vec, k=20, exclude="seed")
    pool.statistical_union(anchor_vec, target_vec, k=10)
    pool.embeddings_for(["a", "b"])
    pool.random_embeddings(200)
    pool.contains("word")
"""

from __future__ import annotations

import json
import os
import random
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Optional, Sequence

import numpy as np

DIMS = 1536

# Rows per chunk when scoring the full matrix. Bounds peak memory of the
# similarity pass to CHUNK * DIMS * 4 bytes (~50 MB) regardless of vocab size.
CHUNK = 8192


def _artifact_dir() -> Path:
    return Path(os.environ.get("VOCAB_ARTIFACT_DIR", Path(__file__).parents[3] / "data"))


class VocabularyPool:
    """Vocabulary + exact vector search, backed by a memory-mapped .npy."""

    _instance: Optional["VocabularyPool"] = None
    _lock = Lock()

    def __init__(self):
        self._words: list[str] = []
        self._index: dict[str, int] = {}
        self._matrix: Optional[np.ndarray] = None
        self._initialized = False
        self._loaded_at: Optional[datetime] = None
        self._meta: dict = {}

    @classmethod
    def get_instance(cls) -> "VocabularyPool":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """Reset the singleton (for testing)."""
        with cls._lock:
            cls._instance = None

    @property
    def is_initialized(self) -> bool:
        return self._initialized

    @property
    def size(self) -> int:
        return len(self._words)

    @property
    def matrix(self) -> Optional[np.ndarray]:
        """The full (N, 1536) memmap. Read-only; do not mutate."""
        return self._matrix

    def initialize(self, artifact_dir: Optional[Path] = None) -> None:
        """Load the artifact. Blocking: the API cannot score anything without it."""
        d = Path(artifact_dir) if artifact_dir else _artifact_dir()
        words_path, npy_path, meta_path = (
            d / "vocab_words.json",
            d / "vocab_embeddings.npy",
            d / "vocab_meta.json",
        )

        missing = [p.name for p in (words_path, npy_path) if not p.exists()]
        if missing:
            raise FileNotFoundError(
                f"Vocabulary artifact incomplete in {d}: missing {', '.join(missing)}. "
                "Fetch it from the GitHub Release, or regenerate with "
                "scripts/export_vocab_artifact.py."
            )

        words = json.loads(words_path.read_text())
        matrix = np.load(npy_path, mmap_mode="r")

        if matrix.shape[0] != len(words):
            raise ValueError(
                f"Artifact mismatch: {matrix.shape[0]} embeddings vs {len(words)} words"
            )
        if matrix.shape[1] != DIMS:
            raise ValueError(f"Expected {DIMS} dims, artifact has {matrix.shape[1]}")

        self._words = words
        self._index = {w: i for i, w in enumerate(words)}
        self._matrix = matrix
        self._meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        self._initialized = True
        self._loaded_at = datetime.now()

        mb = matrix.nbytes / 1e6
        print(f"VocabularyPool: mmap'd {len(words)} x {DIMS} {matrix.dtype} ({mb:.0f} MB) from {d}")

    # ---------------------------------------------------------------- lookup

    def contains(self, word: str) -> bool:
        return word.lower().strip() in self._index

    def embedding_for(self, word: str) -> Optional[np.ndarray]:
        i = self._index.get(word.lower().strip())
        return np.asarray(self._matrix[i], dtype=np.float32) if i is not None else None

    def embeddings_for(self, words: Sequence[str]) -> list[tuple[str, np.ndarray]]:
        """Embeddings for known words, silently skipping unknown ones."""
        out = []
        for w in words:
            i = self._index.get(w.lower().strip())
            if i is not None:
                out.append((w, np.asarray(self._matrix[i], dtype=np.float32)))
        return out

    # ---------------------------------------------------------------- random

    def get_random(self) -> Optional[str]:
        return random.choice(self._words) if self._words else None

    def get_random_batch(self, count: int, allow_duplicates: bool = False) -> list[str]:
        if not self._words:
            return []
        if allow_duplicates:
            return [random.choice(self._words) for _ in range(count)]
        return random.sample(self._words, min(count, len(self._words)))

    def random_indices(self, count: int) -> np.ndarray:
        n = len(self._words)
        return np.random.choice(n, size=min(count, n), replace=False)

    def random_embeddings(self, count: int) -> np.ndarray:
        """A uniform random sample of embeddings, as an (n, 1536) float32 array.

        Replaces services.embeddings.get_vocabulary_sample, which took the first
        `n` physical rows (no ORDER BY) and so drew its null distribution from an
        arbitrary narrow slice of the vocabulary.
        """
        idx = self.random_indices(count)
        return np.asarray(self._matrix[np.sort(idx)], dtype=np.float32)

    def get_random_with_embeddings(self, count: int) -> list[tuple[str, list[float]]]:
        """Random (word, embedding) pairs. Kept for callers that want lists."""
        idx = np.sort(self.random_indices(count))
        return [(self._words[i], np.asarray(self._matrix[i], dtype=np.float32).tolist()) for i in idx]

    # ---------------------------------------------------------------- search

    def _similarities(self, query: np.ndarray) -> np.ndarray:
        """Cosine similarity of `query` against the whole vocabulary.

        Chunked so peak memory stays bounded and float16 artifacts accumulate in
        float32 rather than float16.
        """
        q = np.asarray(query, dtype=np.float32).ravel()
        norm = np.linalg.norm(q)
        if norm > 0:
            q = q / norm  # vocabulary rows are already unit-length

        n = self._matrix.shape[0]
        sims = np.empty(n, dtype=np.float32)
        for start in range(0, n, CHUNK):
            end = min(start + CHUNK, n)
            block = np.asarray(self._matrix[start:end], dtype=np.float32)
            sims[start:end] = block @ q
        return sims

    def nearest(
        self,
        query: np.ndarray,
        k: int = 20,
        exclude: Optional[Sequence[str]] = None,
    ) -> list[tuple[str, float]]:
        """Exact top-k by cosine similarity, descending.

        Replaces RPC get_noise_floor_by_embedding.
        """
        sims = self._similarities(query)

        if exclude:
            if isinstance(exclude, str):
                exclude = [exclude]
            for w in exclude:
                i = self._index.get(w.lower().strip())
                if i is not None:
                    sims[i] = -np.inf

        k = min(k, len(self._words))
        top = np.argpartition(-sims, k - 1)[:k]
        top = top[np.argsort(-sims[top])]
        return [(self._words[i], float(sims[i])) for i in top]

    def statistical_union(
        self,
        anchor: np.ndarray,
        target: np.ndarray,
        k: int = 10,
        exclude: Optional[Sequence[str]] = None,
    ) -> list[dict]:
        """Words closest to anchor and target jointly, ranked by sim_a + sim_t.

        Replaces RPC get_statistical_union. The SQL took the top-200 neighbours of
        each side and ranked their union; ranking the full vocabulary directly is
        exact and a superset of that candidate set.
        """
        sims_a = self._similarities(anchor)
        sims_t = self._similarities(target)
        score = sims_a + sims_t

        if exclude:
            if isinstance(exclude, str):
                exclude = [exclude]
            for w in exclude:
                i = self._index.get(w.lower().strip())
                if i is not None:
                    score[i] = -np.inf

        k = min(k, len(self._words))
        top = np.argpartition(-score, k - 1)[:k]
        top = top[np.argsort(-score[top])]
        return [
            {
                "word": self._words[i],
                "score": float(score[i]),
                "sim_anchor": float(sims_a[i]),
                "sim_target": float(sims_t[i]),
            }
            for i in top
        ]

    # ---------------------------------------------------------------- status

    def get_stats(self) -> dict:
        return {
            "initialized": self._initialized,
            "word_count": len(self._words),
            "dtype": str(self._matrix.dtype) if self._matrix is not None else None,
            "loaded_at": self._loaded_at.isoformat() if self._loaded_at else None,
            "sha256": self._meta.get("sha256"),
        }


# Fallback words if the artifact is unavailable
# Curated for semantic diversity and evocativeness
FALLBACK_WORDS = [
    # Natural phenomena
    "avalanche", "monsoon", "aurora", "eclipse", "erosion",
    # Abstract concepts
    "nostalgia", "vertigo", "paradox", "entropy", "epiphany",
    # Evocative objects/places
    "lighthouse", "archipelago", "labyrinth", "catacomb", "oasis",
    # Sensory/emotional
    "velvet", "thunder", "fragrance", "bitter", "luminous",
    # Actions/processes
    "dissolve", "unravel", "flourish", "collide", "emerge",
    # Unusual/rich words
    "gossamer", "obsidian", "vermillion", "chrysalis", "almanac",
    # Conceptual
    "threshold", "remnant", "catalyst", "cipher", "spectrum",
    # Temporal
    "twilight", "epoch", "perpetual", "fleeting", "vestige",
]


def get_fallback_word() -> str:
    """Get a random word from the fallback list."""
    return random.choice(FALLBACK_WORDS)
