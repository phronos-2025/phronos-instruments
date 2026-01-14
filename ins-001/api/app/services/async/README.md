# Async Services - Background Processing Components

Background processing infrastructure for shifting expensive computation to "dead time" when users aren't waiting.

## Components

### EagerPrecompute

Triggers heavy computation when a task starts, so results are ready before they're needed.

**Key Insight:** Users spend 30-120 seconds typing clues. We only need ~10 seconds to precompute. By starting early, submit feels instant.

**Performance:**
- Clue submission: 23s → <500ms (when precomputed)
- Background computation: ~10 seconds (parallel tasks)

**Usage:**
```python
from app.services.async import EagerPrecompute

precompute = EagerPrecompute.get_instance()

# Start precomputation when game is created
await precompute.start_bridging_precompute(
    game_id="abc123",
    anchor="ocean",
    target="forest",
    recipient_type="haiku",  # or "human"
    supabase=supabase
)

# Later, when clues are submitted (instant if ready)
results = await precompute.get_precomputed_results(
    game_id="abc123",
    timeout_seconds=2.0  # Wait up to 2s if still computing
)

if results and results.status == PrecomputeStatus.COMPLETED:
    # Use precomputed values
    anchor_emb = results.anchor_embedding
    target_emb = results.target_embedding
    haiku_clues = results.haiku_clues  # If haiku game
    null_samples = results.null_samples  # For percentile
    lexical_bridge = results.lexical_bridge
```

## What Gets Precomputed

When a bridging game is created:

1. **Anchor + Target Embeddings** (~1.5s)
   - Cached for use when clues are submitted

2. **Haiku Bridge** (~3s, if recipient_type="haiku")
   - Claude Haiku generates its own bridge
   - Ready instantly when user submits

3. **Null Distribution Samples** (~5s)
   - 100 bootstrap samples for percentile calculation
   - Eliminates 10-15s bootstrap on submit

4. **Lexical Union** (~2s)
   - Statistical baseline (equidistant words)
   - Ready for comparison scoring

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER FLOW                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [1] User enters anchor + target                            │
│       │                                                      │
│       ▼                                                      │
│  POST /bridging/ creates game                               │
│       │                                                      │
│       ├──────────────────────────────────────┐              │
│       │                                       │              │
│       ▼                                       ▼              │
│  [2] User sees "Enter 5 concepts"    BACKGROUND TASKS:      │
│       │                               • Embed anchor/target  │
│       │                               • Generate Haiku       │
│       │                               • Compute null dist    │
│       │                               • Find lexical union   │
│       │                                       │              │
│       │ (30-120 seconds typing)               │ (~10 secs)   │
│       │                                       │              │
│       ▼                                       ▼              │
│  [3] User clicks "Submit"            [READY!]               │
│       │                                       │              │
│       └───────────────────────────────────────┘              │
│                       │                                      │
│                       ▼                                      │
│              POST /clues uses precomputed values            │
│                       │                                      │
│                       ▼                                      │
│              Response in <500ms (not 23 seconds)            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Result Structure

```python
@dataclass
class PrecomputeResult:
    game_id: str
    status: PrecomputeStatus  # PENDING, IN_PROGRESS, COMPLETED, FAILED
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error: Optional[str]

    # Precomputed data
    anchor_embedding: Optional[list[float]]
    target_embedding: Optional[list[float]]
    haiku_clues: Optional[list[str]]
    haiku_embeddings: Optional[list[list[float]]]
    lexical_bridge: Optional[list[str]]
    lexical_embeddings: Optional[list[list[float]]]
    null_samples: Optional[list[float]]
```

## Error Handling

If precomputation fails or isn't ready:
- `get_precomputed_results()` returns partial results
- Calling code should fall back to synchronous computation
- Non-fatal: still works, just slower

```python
results = await precompute.get_precomputed_results(game_id)

if results and results.anchor_embedding:
    # Use precomputed
    anchor_emb = results.anchor_embedding
else:
    # Fallback to live computation
    anchor_emb = await cache.get_embedding(anchor)
```

## Monitoring

```python
precompute = EagerPrecompute.get_instance()

stats = precompute.get_stats()
# {
#     "total_cached": 50,
#     "active_tasks": 3,
#     "status_counts": {"completed": 45, "in_progress": 3, "failed": 2}
# }

# Check specific game
status = precompute.get_status(game_id)
# PrecomputeStatus.COMPLETED
```

## Configuration

```python
# In eager_precompute.py
RESULT_TTL_MINUTES = 30  # How long to keep results
MAX_CACHED_RESULTS = 1000  # Prevent memory bloat
```

## For Future Agents

The "eager precomputation" pattern applies whenever:

1. **Predictable computation** - You know what will be needed
2. **User wait time** - User spends time on another task
3. **Background opportunity** - Can compute while user works

Examples:
- INS-001.2: Precompute while user types clues
- Future: Precompute recommendations while user reads
- Future: Pre-generate comparisons while user makes selections

To add new precomputation:

```python
# 1. Add method to EagerPrecompute
async def start_my_precompute(self, context_id, ...):
    result = PrecomputeResult(...)
    # Start background tasks
    asyncio.create_task(self._run_my_precomputation(result, ...))

# 2. Call from your endpoint
await precompute.start_my_precompute(...)

# 3. Retrieve results later
results = await precompute.get_precomputed_results(context_id)
```
