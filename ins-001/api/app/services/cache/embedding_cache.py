"""
EmbeddingCache - LRU Cache for OpenAI Embeddings

Eliminates redundant OpenAI API calls by caching embeddings in memory.
Thread-safe singleton with TTL-based expiration.

Performance Impact:
- Cache hit: <1ms (vs 1-1.5s API call)
- Memory: ~6KB per embedding (1536 floats × 4 bytes)
- Default max: 10,000 entries = ~60MB memory

Usage:
    cache = EmbeddingCache.get_instance()

    # Single embedding (checks cache first)
    embedding = await cache.get_embedding("word")

    # Batch embeddings (checks cache, only fetches misses)
    embeddings = await cache.get_embeddings_batch(["word1", "word2", "word3"])

    # Cache stats
    stats = cache.get_stats()  # {"hits": 100, "misses": 20, "size": 120}
"""

import asyncio
import time
from typing import Optional
from collections import OrderedDict
from threading import Lock


class EmbeddingCache:
    """Thread-safe LRU cache for word embeddings with TTL expiration."""

    _instance: Optional["EmbeddingCache"] = None
    _lock = Lock()

    # Configuration
    DEFAULT_MAX_SIZE = 10_000  # Max cached embeddings
    DEFAULT_TTL_SECONDS = 3600  # 1 hour TTL

    def __init__(
        self,
        max_size: int = DEFAULT_MAX_SIZE,
        ttl_seconds: int = DEFAULT_TTL_SECONDS
    ):
        """
        Initialize the embedding cache.

        Args:
            max_size: Maximum number of embeddings to cache
            ttl_seconds: Time-to-live for cache entries in seconds
        """
        self._cache: OrderedDict[str, tuple[list[float], float]] = OrderedDict()
        self._max_size = max_size
        self._ttl_seconds = ttl_seconds
        self._hits = 0
        self._misses = 0
        self._cache_lock = Lock()

        # Lazy import to avoid circular dependency
        self._openai_client = None
        self._embedding_model = None

    @classmethod
    def get_instance(cls) -> "EmbeddingCache":
        """Get the singleton instance of EmbeddingCache."""
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

    def _get_openai_client(self):
        """Lazy load OpenAI client to avoid import issues."""
        if self._openai_client is None:
            from app.services.embeddings import openai_client, EMBEDDING_MODEL
            self._openai_client = openai_client
            self._embedding_model = EMBEDDING_MODEL
        return self._openai_client, self._embedding_model

    def _normalize_key(self, text: str) -> str:
        """Normalize text for consistent cache keys."""
        return text.lower().strip()

    def _is_expired(self, timestamp: float) -> bool:
        """Check if a cache entry has expired."""
        return time.time() - timestamp > self._ttl_seconds

    def _get_from_cache(self, key: str) -> Optional[list[float]]:
        """
        Get embedding from cache if present and not expired.
        Updates LRU order on hit.
        """
        with self._cache_lock:
            if key in self._cache:
                embedding, timestamp = self._cache[key]
                if not self._is_expired(timestamp):
                    # Move to end (most recently used)
                    self._cache.move_to_end(key)
                    self._hits += 1
                    return embedding
                else:
                    # Expired, remove it
                    del self._cache[key]
            self._misses += 1
            return None

    def _put_in_cache(self, key: str, embedding: list[float]) -> None:
        """Add embedding to cache, evicting LRU if needed."""
        with self._cache_lock:
            # Remove oldest if at capacity
            while len(self._cache) >= self._max_size:
                self._cache.popitem(last=False)

            self._cache[key] = (embedding, time.time())

    async def get_embedding(self, text: str) -> list[float]:
        """
        Get embedding for a single text, using cache when possible.

        Args:
            text: Text to embed

        Returns:
            1536-dimensional embedding vector
        """
        key = self._normalize_key(text)

        # Check cache first
        cached = self._get_from_cache(key)
        if cached is not None:
            return cached

        # Cache miss - fetch from OpenAI
        client, model = self._get_openai_client()
        response = await client.embeddings.create(
            model=model,
            input=text
        )
        embedding = response.data[0].embedding

        # Store in cache
        self._put_in_cache(key, embedding)

        return embedding

    async def get_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Get embeddings for multiple texts, using cache for hits.

        Only makes API calls for cache misses, preserving original order.

        Args:
            texts: List of texts to embed

        Returns:
            List of embeddings in same order as input texts
        """
        if not texts:
            return []

        # Normalize all keys
        keys = [self._normalize_key(t) for t in texts]

        # Check cache for each
        results: list[Optional[list[float]]] = []
        misses: list[tuple[int, str, str]] = []  # (index, key, original_text)

        for i, (key, text) in enumerate(zip(keys, texts)):
            cached = self._get_from_cache(key)
            if cached is not None:
                results.append(cached)
            else:
                results.append(None)
                misses.append((i, key, text))

        # Fetch misses from OpenAI in single batch
        if misses:
            client, model = self._get_openai_client()
            miss_texts = [m[2] for m in misses]

            response = await client.embeddings.create(
                model=model,
                input=miss_texts
            )

            # Store results and update results list
            for (idx, key, _), item in zip(misses, response.data):
                embedding = item.embedding
                self._put_in_cache(key, embedding)
                results[idx] = embedding

        return results  # type: ignore (all None values have been filled)

    async def get_contextual_embedding(
        self,
        word: str,
        context: list[str]
    ) -> list[float]:
        """
        Get embedding for a word with semantic context.

        Context is incorporated into the cache key, so different
        contexts produce different cached embeddings.

        Args:
            word: Word to embed
            context: List of context words for disambiguation

        Returns:
            1536-dimensional embedding vector
        """
        if context:
            text = f"{word} (in context: {', '.join(context)})"
        else:
            text = word

        return await self.get_embedding(text)

    def get_stats(self) -> dict:
        """Get cache statistics."""
        with self._cache_lock:
            return {
                "hits": self._hits,
                "misses": self._misses,
                "size": len(self._cache),
                "max_size": self._max_size,
                "hit_rate": self._hits / (self._hits + self._misses) if (self._hits + self._misses) > 0 else 0,
            }

    def clear(self) -> None:
        """Clear all cached embeddings."""
        with self._cache_lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0

    def warm_up(self, words: list[str]) -> None:
        """
        Pre-warm cache with common words (synchronous, for startup).

        Args:
            words: List of words to pre-cache
        """
        async def _warm():
            await self.get_embeddings_batch(words)

        asyncio.run(_warm())
