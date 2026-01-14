"""
EagerPrecompute - Background Computation During User "Think Time"

Triggers expensive computations when a game is created (anchor+target chosen),
so results are ready by the time the user submits their clues.

Key Insight: Users spend 30-120 seconds typing clues. We only need ~10 seconds
to precompute everything. By starting computation early, the submit feels instant.

Performance Impact:
- Clue submission: 23s → <500ms (when precomputation is complete)
- Worst case (fast user): Still ~5-10s faster than synchronous

What Gets Precomputed:
1. Anchor + target embeddings
2. Haiku bridge generation (if recipient_type="haiku")
3. Null distribution samples for percentile calculation
4. Lexical union (statistical baseline)

Usage:
    precompute = EagerPrecompute.get_instance()

    # Start precomputation when game is created
    await precompute.start_bridging_precompute(
        game_id="abc123",
        anchor="ocean",
        target="forest",
        recipient_type="haiku",
        supabase=supabase
    )

    # Get results when clues are submitted (instant if ready)
    results = await precompute.get_precomputed_results("abc123")
    if results:
        anchor_emb = results["anchor_embedding"]
        haiku_clues = results["haiku_clues"]
        ...
"""

import asyncio
from typing import Optional, Any
from threading import Lock
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum


class PrecomputeStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class PrecomputeResult:
    """Container for precomputed results."""
    game_id: str
    status: PrecomputeStatus = PrecomputeStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None

    # Precomputed data
    anchor_embedding: Optional[list[float]] = None
    target_embedding: Optional[list[float]] = None
    haiku_clues: Optional[list[str]] = None
    haiku_embeddings: Optional[list[list[float]]] = None
    lexical_bridge: Optional[list[str]] = None
    lexical_embeddings: Optional[list[list[float]]] = None
    null_samples: Optional[list[float]] = None  # Relevance scores from random samples


class EagerPrecompute:
    """Background precomputation manager for bridging games."""

    _instance: Optional["EagerPrecompute"] = None
    _lock = Lock()

    # Configuration
    RESULT_TTL_MINUTES = 30  # How long to keep results
    MAX_CACHED_RESULTS = 1000  # Prevent memory bloat

    def __init__(self):
        """Initialize the precompute manager."""
        self._results: dict[str, PrecomputeResult] = {}
        self._tasks: dict[str, asyncio.Task] = {}
        self._results_lock = Lock()

    @classmethod
    def get_instance(cls) -> "EagerPrecompute":
        """Get the singleton instance."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """Reset the singleton (for testing)."""
        with cls._lock:
            if cls._instance:
                # Cancel any running tasks
                for task in cls._instance._tasks.values():
                    task.cancel()
            cls._instance = None

    async def start_bridging_precompute(
        self,
        game_id: str,
        anchor: str,
        target: str,
        recipient_type: str,
        supabase: Any
    ) -> None:
        """
        Start background precomputation for a bridging game.

        Call this immediately after creating a game. The computation runs
        in the background while the user types their clues.

        Args:
            game_id: Unique game identifier
            anchor: Anchor word
            target: Target word
            recipient_type: "human" or "haiku"
            supabase: Authenticated Supabase client
        """
        # Create result container
        result = PrecomputeResult(
            game_id=game_id,
            status=PrecomputeStatus.IN_PROGRESS,
            started_at=datetime.now()
        )

        with self._results_lock:
            self._results[game_id] = result
            self._cleanup_old_results()

        # Start background task
        task = asyncio.create_task(
            self._run_precomputation(
                result=result,
                anchor=anchor,
                target=target,
                recipient_type=recipient_type,
                supabase=supabase
            )
        )

        self._tasks[game_id] = task

    async def _run_precomputation(
        self,
        result: PrecomputeResult,
        anchor: str,
        target: str,
        recipient_type: str,
        supabase: Any
    ) -> None:
        """
        Run all precomputation tasks concurrently.

        This runs in the background while the user is typing clues.
        """
        try:
            # Import here to avoid circular dependencies
            from app.services.cache import EmbeddingCache, VocabularyPool
            from app.services.llm import haiku_build_bridge
            from app.services.scoring_bridging import find_lexical_union

            cache = EmbeddingCache.get_instance()
            pool = VocabularyPool.get_instance()

            # Run tasks concurrently
            tasks = []

            # Task 1: Embed anchor + target
            async def embed_anchor_target():
                embeddings = await cache.get_embeddings_batch([anchor, target])
                result.anchor_embedding = embeddings[0]
                result.target_embedding = embeddings[1]

            tasks.append(embed_anchor_target())

            # Task 2: Generate Haiku bridge (if haiku game)
            if recipient_type == "haiku":
                async def generate_haiku():
                    try:
                        haiku_result = await haiku_build_bridge(anchor, target, num_clues=5)
                        haiku_clues = haiku_result.get("clues", [])
                        result.haiku_clues = haiku_clues
                        if haiku_clues:
                            result.haiku_embeddings = await cache.get_embeddings_batch(haiku_clues)
                    except Exception as e:
                        print(f"EagerPrecompute: Haiku generation failed: {e}")
                        result.haiku_clues = []

                tasks.append(generate_haiku())

            # Task 3: Find lexical union (statistical baseline)
            async def compute_lexical_union():
                try:
                    lexical_words = await find_lexical_union(
                        anchor,
                        target,
                        5,  # num_concepts
                        supabase
                    )
                    result.lexical_bridge = lexical_words
                    if lexical_words:
                        result.lexical_embeddings = await cache.get_embeddings_batch(lexical_words)
                except Exception as e:
                    print(f"EagerPrecompute: Lexical union failed: {e}")
                    result.lexical_bridge = []

            tasks.append(compute_lexical_union())

            # Task 4: Compute null distribution samples
            async def compute_null_samples():
                try:
                    # Get random vocabulary samples for bootstrap
                    vocab_samples = pool.get_random_with_embeddings(200)
                    if len(vocab_samples) >= 50:
                        import numpy as np

                        # Compute relevance scores for random samples
                        null_scores = []
                        vocab_embs = np.array([emb for _, emb in vocab_samples])

                        # Wait for anchor/target embeddings
                        while result.anchor_embedding is None:
                            await asyncio.sleep(0.1)

                        anchor_emb = np.array(result.anchor_embedding)
                        target_emb = np.array(result.target_embedding)

                        rng = np.random.default_rng()

                        for _ in range(100):  # 100 bootstrap samples
                            # Pick 5 random "clues"
                            indices = rng.choice(len(vocab_embs), size=5, replace=False)
                            sample_embs = vocab_embs[indices]

                            # Compute relevance
                            sample_norms = sample_embs / np.linalg.norm(sample_embs, axis=1, keepdims=True)
                            anchor_norm = anchor_emb / np.linalg.norm(anchor_emb)
                            target_norm = target_emb / np.linalg.norm(target_emb)

                            anchor_sims = np.dot(sample_norms, anchor_norm)
                            target_sims = np.dot(sample_norms, target_norm)

                            relevance = (np.mean(anchor_sims) + np.mean(target_sims)) / 2
                            null_scores.append(float(relevance))

                        result.null_samples = sorted(null_scores)
                except Exception as e:
                    print(f"EagerPrecompute: Null samples failed: {e}")
                    result.null_samples = []

            tasks.append(compute_null_samples())

            # Run all tasks concurrently
            await asyncio.gather(*tasks, return_exceptions=True)

            result.status = PrecomputeStatus.COMPLETED
            result.completed_at = datetime.now()

            elapsed = (result.completed_at - result.started_at).total_seconds()
            print(f"EagerPrecompute: Game {result.game_id} completed in {elapsed:.2f}s")

        except Exception as e:
            result.status = PrecomputeStatus.FAILED
            result.error = str(e)
            print(f"EagerPrecompute: Game {result.game_id} failed: {e}")

    async def get_precomputed_results(
        self,
        game_id: str,
        timeout_seconds: float = 5.0
    ) -> Optional[PrecomputeResult]:
        """
        Get precomputed results for a game.

        If precomputation is still in progress, waits up to timeout_seconds.

        Args:
            game_id: Game identifier
            timeout_seconds: Max time to wait for completion

        Returns:
            PrecomputeResult if available, None if not found
        """
        with self._results_lock:
            result = self._results.get(game_id)

        if result is None:
            return None

        # If already complete or failed, return immediately
        if result.status in (PrecomputeStatus.COMPLETED, PrecomputeStatus.FAILED):
            return result

        # Wait for completion
        task = self._tasks.get(game_id)
        if task:
            try:
                await asyncio.wait_for(
                    asyncio.shield(task),
                    timeout=timeout_seconds
                )
            except asyncio.TimeoutError:
                print(f"EagerPrecompute: Timeout waiting for game {game_id}")
            except asyncio.CancelledError:
                pass

        return result

    def get_status(self, game_id: str) -> Optional[PrecomputeStatus]:
        """Get the status of precomputation for a game."""
        with self._results_lock:
            result = self._results.get(game_id)
            return result.status if result else None

    def _cleanup_old_results(self) -> None:
        """Remove old results to prevent memory bloat."""
        cutoff = datetime.now() - timedelta(minutes=self.RESULT_TTL_MINUTES)

        to_remove = []
        for game_id, result in self._results.items():
            if result.completed_at and result.completed_at < cutoff:
                to_remove.append(game_id)

        for game_id in to_remove:
            del self._results[game_id]
            if game_id in self._tasks:
                del self._tasks[game_id]

        # Also limit total cached results
        while len(self._results) > self.MAX_CACHED_RESULTS:
            # Remove oldest
            oldest_id = min(
                self._results.keys(),
                key=lambda k: self._results[k].started_at or datetime.max
            )
            del self._results[oldest_id]
            if oldest_id in self._tasks:
                del self._tasks[oldest_id]

    def get_stats(self) -> dict:
        """Get precompute manager statistics."""
        with self._results_lock:
            status_counts = {}
            for result in self._results.values():
                status_counts[result.status.value] = status_counts.get(result.status.value, 0) + 1

            return {
                "total_cached": len(self._results),
                "active_tasks": len([t for t in self._tasks.values() if not t.done()]),
                "status_counts": status_counts,
            }
