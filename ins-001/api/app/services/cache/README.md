# Cache Services - Performance Optimization Components

Reusable caching infrastructure for INS-001 and future Phronos instruments.

## Components

### 1. EmbeddingCache

LRU cache for OpenAI embeddings. Eliminates redundant API calls.

**Performance:**
- Cache hit: <1ms (vs 1-1.5s API call)
- Memory: ~6KB per embedding
- Default capacity: 10,000 embeddings (~60MB)

**Usage:**
```python
from app.services.cache import EmbeddingCache

cache = EmbeddingCache.get_instance()

# Single embedding (checks cache first)
embedding = await cache.get_embedding("word")

# Batch embeddings (only fetches cache misses)
embeddings = await cache.get_embeddings_batch(["word1", "word2", "word3"])

# Contextual embedding (for polysemous words)
embedding = await cache.get_contextual_embedding("bank", ["river", "water"])

# Check stats
stats = cache.get_stats()
# {"hits": 100, "misses": 20, "size": 120, "hit_rate": 0.83}
```

### 2. VocabularyPool

Memory-mapped vocabulary artifact: words, embeddings, and exact vector search.

**Performance:**
- Random word: <1ms
- Exact nearest-neighbour over 30k x 1536: ~3ms (vs 270-600ms for the old pgvector RPC)
- Memory: 184 MB float32, mmap'd — resident pages managed by the OS, not the heap
- Startup: blocking (mmap is near-instant); the API cannot score without it

**Usage:**
```python
from app.services.cache import VocabularyPool

pool = VocabularyPool.get_instance()

# Initialize at startup (call once)
await pool.initialize(supabase_client, load_embeddings=True)

# Get random word instantly
word = pool.get_random()

# Get multiple random words
words = pool.get_random_batch(10)

# Get words with embeddings (for bootstrap sampling)
samples = pool.get_random_with_embeddings(100)
# Returns: [(word, embedding), ...]

# Check if word exists
exists = pool.contains("ocean")
```

### 3. StatsCache

Pre-computed null distributions for instant percentile calculations.

**Performance:**
- Percentile lookup: <1ms (vs 10-15s bootstrap)
- Memory: ~50KB per distribution

**Usage:**
```python
from app.services.cache import StatsCache

cache = StatsCache.get_instance()

# Initialize at startup
await cache.initialize(vocabulary_pool)

# Get percentile instantly
percentile = cache.get_relevance_percentile(
    relevance_score=0.75,
    num_clues=5
)
```

## Initialization

All caches are singletons. Initialize once at app startup:

```python
# In main.py lifespan
from app.services.cache import VocabularyPool, StatsCache

pool = VocabularyPool.get_instance()
await pool.initialize(supabase_client, load_embeddings=True)

stats = StatsCache.get_instance()
await stats.initialize(pool)
```

## Configuration

Environment variables (optional):
- No additional env vars needed
- Uses existing `OPENAI_API_KEY` for embedding generation

Code configuration:
```python
# EmbeddingCache
EmbeddingCache.DEFAULT_MAX_SIZE = 10_000  # Max cached embeddings
EmbeddingCache.DEFAULT_TTL_SECONDS = 3600  # 1 hour TTL

# VocabularyPool
VocabularyPool.REFRESH_INTERVAL_HOURS = 1

# StatsCache
StatsCache.NUM_BOOTSTRAP_SAMPLES = 200
StatsCache.REFRESH_INTERVAL_MINUTES = 30
```

## Thread Safety

All cache components are thread-safe and can be used from multiple async handlers concurrently.

## Monitoring

Check cache health:
```python
from app.services.cache import EmbeddingCache, VocabularyPool, StatsCache

# Embedding cache stats
emb_stats = EmbeddingCache.get_instance().get_stats()

# Vocabulary pool stats
vocab_stats = VocabularyPool.get_instance().get_stats()

# Stats cache stats
stats_stats = StatsCache.get_instance().get_stats()
```

## For Future Agents

When working on new instruments:

1. **Always use EmbeddingCache** for embedding generation:
   ```python
   # DO THIS
   cache = EmbeddingCache.get_instance()
   emb = await cache.get_embedding(word)

   # NOT THIS
   emb = await get_embedding(word)  # Direct API call
   ```

2. **Use VocabularyPool** for anything vocabulary-shaped. There is no
   `vocabulary_embeddings` table any more; the pool owns the words, the embeddings,
   and nearest-neighbour search, served from a memory-mapped `.npy` artifact.
   ```python
   pool = VocabularyPool.get_instance()
   word = pool.get_random()
   pool.nearest(query_vec, k=20, exclude="seed")      # was: get_noise_floor_by_embedding RPC
   pool.statistical_union(anchor_vec, target_vec, 10) # was: get_statistical_union RPC
   pool.embeddings_for(["a", "b"])
   pool.random_embeddings(200)
   pool.contains("word")
   ```

3. **Precompute when possible**: If user will wait before needing results, start computation early using `EagerPrecompute`.
