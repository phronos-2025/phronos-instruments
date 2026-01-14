"""
Cache Services - Reusable Performance Components

This module provides caching infrastructure for INS-001 and future instruments.

Components:
- EmbeddingCache: LRU cache for OpenAI embeddings (eliminates redundant API calls)
- VocabularyPool: In-memory vocabulary for instant random selection
- StatsCache: Pre-computed null distributions for percentile calculations
- NoiseFloorCache: LRU cache for noise floor results (eliminates repeated computations)

Usage:
    from app.services.cache import EmbeddingCache, VocabularyPool, NoiseFloorCache

    # Embedding cache (singleton)
    cache = EmbeddingCache.get_instance()
    embedding = await cache.get_embedding("word")
    embeddings = await cache.get_embeddings_batch(["word1", "word2"])

    # Vocabulary pool (singleton, loaded at startup)
    pool = VocabularyPool.get_instance()
    random_word = pool.get_random()

    # Noise floor cache (singleton)
    nf_cache = NoiseFloorCache.get_instance()
    cached = nf_cache.get(seed_word)
"""

from app.services.cache.embedding_cache import EmbeddingCache
from app.services.cache.vocabulary_pool import VocabularyPool
from app.services.cache.stats_cache import StatsCache
from app.services.cache.noise_floor_cache import NoiseFloorCache

__all__ = ["EmbeddingCache", "VocabularyPool", "StatsCache", "NoiseFloorCache"]
