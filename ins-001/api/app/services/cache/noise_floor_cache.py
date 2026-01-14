"""
NoiseFloorCache - LRU Cache for Noise Floor Results

Caches complete noise floor computation results to avoid repeated
embedding + pgvector + LLM fallback calls for the same seed word.

Performance Impact:
- Cache hit: <1ms (vs 2-5s full computation)
- Memory: ~2KB per entry (20 words × 100 bytes avg)
- Default max: 1,000 entries = ~2MB memory

Usage:
    cache = NoiseFloorCache.get_instance()

    # Check cache first
    cached = cache.get(seed_word)
    if cached is not None:
        return cached

    # Compute noise floor...
    result = await compute_noise_floor(...)

    # Store in cache
    cache.put(seed_word, result)
"""

import time
from typing import Optional
from collections import OrderedDict
from threading import Lock


class NoiseFloorCache:
    """Thread-safe LRU cache for noise floor results with TTL expiration."""

    _instance: Optional["NoiseFloorCache"] = None
    _lock = Lock()

    # Configuration
    DEFAULT_MAX_SIZE = 1_000  # Max cached noise floors
    DEFAULT_TTL_SECONDS = 3600  # 1 hour TTL

    def __init__(
        self,
        max_size: int = DEFAULT_MAX_SIZE,
        ttl_seconds: int = DEFAULT_TTL_SECONDS
    ):
        """
        Initialize the noise floor cache.

        Args:
            max_size: Maximum number of noise floors to cache
            ttl_seconds: Time-to-live for cache entries in seconds
        """
        # Key: (seed_word, sense_context_tuple, k)
        # Value: (result_list, timestamp)
        self._cache: OrderedDict[tuple, tuple[list[dict], float]] = OrderedDict()
        self._max_size = max_size
        self._ttl_seconds = ttl_seconds
        self._hits = 0
        self._misses = 0
        self._cache_lock = Lock()

    @classmethod
    def get_instance(cls) -> "NoiseFloorCache":
        """Get the singleton instance of NoiseFloorCache."""
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

    def _make_key(
        self,
        seed_word: str,
        sense_context: Optional[list[str]],
        k: int
    ) -> tuple:
        """Create a hashable cache key."""
        seed_normalized = seed_word.lower().strip()
        context_tuple = tuple(sorted(sense_context)) if sense_context else ()
        return (seed_normalized, context_tuple, k)

    def _is_expired(self, timestamp: float) -> bool:
        """Check if a cache entry has expired."""
        return time.time() - timestamp > self._ttl_seconds

    def get(
        self,
        seed_word: str,
        sense_context: Optional[list[str]] = None,
        k: int = 20
    ) -> Optional[list[dict]]:
        """
        Get noise floor from cache if present and not expired.

        Args:
            seed_word: The seed word
            sense_context: Optional context words for disambiguation
            k: Number of results requested

        Returns:
            Cached noise floor results, or None if not in cache
        """
        key = self._make_key(seed_word, sense_context, k)

        with self._cache_lock:
            if key in self._cache:
                result, timestamp = self._cache[key]
                if not self._is_expired(timestamp):
                    # Move to end (most recently used)
                    self._cache.move_to_end(key)
                    self._hits += 1
                    return result
                else:
                    # Expired, remove it
                    del self._cache[key]
            self._misses += 1
            return None

    def put(
        self,
        seed_word: str,
        result: list[dict],
        sense_context: Optional[list[str]] = None,
        k: int = 20
    ) -> None:
        """
        Add noise floor result to cache.

        Args:
            seed_word: The seed word
            result: The computed noise floor results
            sense_context: Optional context words used
            k: Number of results requested
        """
        key = self._make_key(seed_word, sense_context, k)

        with self._cache_lock:
            # Remove oldest if at capacity
            while len(self._cache) >= self._max_size:
                self._cache.popitem(last=False)

            self._cache[key] = (result, time.time())

    def get_stats(self) -> dict:
        """Get cache statistics."""
        with self._cache_lock:
            total = self._hits + self._misses
            return {
                "hits": self._hits,
                "misses": self._misses,
                "size": len(self._cache),
                "max_size": self._max_size,
                "hit_rate": self._hits / total if total > 0 else 0,
            }

    def clear(self) -> None:
        """Clear all cached noise floors."""
        with self._cache_lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0
