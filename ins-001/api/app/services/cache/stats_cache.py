"""
StatsCache - Pre-computed Null Distributions for Instant Percentile Lookup

Pre-computes bootstrap null distributions at startup and caches them
for instant percentile calculations. Eliminates the 10-15s bootstrap
computation on each clue submission.

Performance Impact:
- Percentile lookup: <1ms (vs 10-15s bootstrap computation)
- Memory: ~50KB per distribution (200 samples × 8 bytes × 30 percentiles)
- Startup: ~30s to pre-compute (async, non-blocking)

Usage:
    cache = StatsCache.get_instance()
    await cache.initialize(vocabulary_pool)

    # Instant percentile lookup
    percentile = cache.get_relevance_percentile(
        relevance_score=0.75,
        num_clues=5
    )
"""

import asyncio
import numpy as np
from typing import Optional
from threading import Lock
from datetime import datetime, timedelta


class StatsCache:
    """Pre-computed null distributions for instant percentile calculations."""

    _instance: Optional["StatsCache"] = None
    _lock = Lock()

    # Configuration
    NUM_BOOTSTRAP_SAMPLES = 200  # Samples per distribution
    REFRESH_INTERVAL_MINUTES = 30

    def __init__(self):
        """Initialize the stats cache (empty until initialized)."""
        # Null distributions keyed by num_clues
        # Each value is a sorted array of relevance scores
        self._null_distributions: dict[int, np.ndarray] = {}
        self._initialized = False
        self._last_refresh: Optional[datetime] = None
        self._cache_lock = Lock()

    @classmethod
    def get_instance(cls) -> "StatsCache":
        """Get the singleton instance of StatsCache."""
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
        """Check if the cache has been initialized."""
        return self._initialized

    async def initialize(
        self,
        vocabulary_pool,
        clue_counts: list[int] = None
    ) -> None:
        """
        Pre-compute null distributions for different clue counts.

        Args:
            vocabulary_pool: VocabularyPool instance with embeddings loaded
            clue_counts: List of clue counts to pre-compute (default: 1-7)
        """
        from app.services.cache import VocabularyPool

        if clue_counts is None:
            clue_counts = [1, 2, 3, 4, 5, 6, 7]

        print("StatsCache: Pre-computing null distributions...")
        start_time = datetime.now()

        # Get embeddings from vocabulary pool
        vocab_samples = vocabulary_pool.get_random_with_embeddings(500)

        if len(vocab_samples) < 100:
            print("StatsCache: Not enough vocabulary embeddings, skipping pre-computation")
            self._initialized = True
            return

        # Convert embeddings to numpy for fast computation
        vocab_embeddings = np.array([emb for _, emb in vocab_samples])

        for num_clues in clue_counts:
            distribution = self._compute_null_distribution(
                vocab_embeddings,
                num_clues,
                self.NUM_BOOTSTRAP_SAMPLES
            )

            with self._cache_lock:
                self._null_distributions[num_clues] = distribution

        self._initialized = True
        self._last_refresh = datetime.now()

        elapsed = (datetime.now() - start_time).total_seconds()
        print(f"StatsCache: Pre-computed {len(clue_counts)} distributions in {elapsed:.2f}s")

    def _compute_null_distribution(
        self,
        vocab_embeddings: np.ndarray,
        num_clues: int,
        num_samples: int
    ) -> np.ndarray:
        """
        Compute null distribution for a given number of clues.

        Simulates random clue selection and computes relevance scores.

        Args:
            vocab_embeddings: Array of vocabulary embeddings (N, 1536)
            num_clues: Number of clues to simulate
            num_samples: Number of bootstrap samples

        Returns:
            Sorted array of relevance scores
        """
        rng = np.random.default_rng()
        relevance_scores = []

        # For null distribution, we simulate random "anchor" and "target"
        # by picking random embeddings and computing average similarity
        for _ in range(num_samples):
            # Pick random anchor, target, and clues
            indices = rng.choice(len(vocab_embeddings), size=2 + num_clues, replace=False)
            anchor_emb = vocab_embeddings[indices[0]]
            target_emb = vocab_embeddings[indices[1]]
            clue_embs = vocab_embeddings[indices[2:]]

            # Compute relevance (average similarity to anchor and target)
            anchor_sims = self._cosine_similarity_batch(clue_embs, anchor_emb)
            target_sims = self._cosine_similarity_batch(clue_embs, target_emb)

            # Relevance = average of (avg similarity to anchor, avg similarity to target)
            avg_anchor_sim = np.mean(anchor_sims)
            avg_target_sim = np.mean(target_sims)
            relevance = (avg_anchor_sim + avg_target_sim) / 2

            relevance_scores.append(relevance)

        return np.sort(relevance_scores)

    def _cosine_similarity_batch(
        self,
        embeddings: np.ndarray,
        reference: np.ndarray
    ) -> np.ndarray:
        """Compute cosine similarity between multiple embeddings and a reference."""
        # Normalize
        embeddings_norm = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
        reference_norm = reference / np.linalg.norm(reference)

        # Dot product
        return np.dot(embeddings_norm, reference_norm)

    def get_relevance_percentile(
        self,
        relevance_score: float,
        num_clues: int
    ) -> float:
        """
        Get percentile for a relevance score from cached null distribution.

        Args:
            relevance_score: Relevance score (0-1)
            num_clues: Number of clues used

        Returns:
            Percentile (0-100) - higher is better
        """
        with self._cache_lock:
            distribution = self._null_distributions.get(num_clues)

        if distribution is None:
            # Fallback: assume 50th percentile if not pre-computed
            return 50.0

        # Find percentile using binary search
        idx = np.searchsorted(distribution, relevance_score)
        percentile = (idx / len(distribution)) * 100

        return min(99.9, max(0.1, percentile))

    def get_divergence_percentile(
        self,
        divergence_score: float,
        num_clues: int
    ) -> float:
        """
        Get percentile for a divergence score.

        Note: This is a placeholder - divergence distributions would need
        separate pre-computation. For now, uses a simple heuristic.

        Args:
            divergence_score: Divergence score (0-100 DAT scale)
            num_clues: Number of clues used

        Returns:
            Percentile (0-100)
        """
        # Heuristic based on DAT norms (Olson et al., 2021)
        # Average divergence is ~75-80
        if divergence_score < 50:
            return divergence_score * 0.5  # 0-25 percentile
        elif divergence_score < 70:
            return 25 + (divergence_score - 50) * 1.25  # 25-50 percentile
        elif divergence_score < 85:
            return 50 + (divergence_score - 70) * 2.0  # 50-80 percentile
        else:
            return 80 + (divergence_score - 85) * 1.0  # 80-95 percentile

    def needs_refresh(self) -> bool:
        """Check if the cache should be refreshed."""
        if not self._last_refresh:
            return True
        return datetime.now() - self._last_refresh > timedelta(minutes=self.REFRESH_INTERVAL_MINUTES)

    def get_stats(self) -> dict:
        """Get cache statistics."""
        with self._cache_lock:
            return {
                "initialized": self._initialized,
                "distributions_cached": list(self._null_distributions.keys()),
                "samples_per_distribution": self.NUM_BOOTSTRAP_SAMPLES,
                "last_refresh": self._last_refresh.isoformat() if self._last_refresh else None,
                "needs_refresh": self.needs_refresh(),
            }

    def clear(self) -> None:
        """Clear all cached distributions."""
        with self._cache_lock:
            self._null_distributions.clear()
            self._initialized = False
            self._last_refresh = None
