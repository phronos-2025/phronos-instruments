"""
Re-score the archive with exact vector search - INS-001

Writes to `games.sender_scores_v2`. Never touches `games.sender_scores`: those
values were produced by an approximate ivfflat index that was rebuilt several times
during the study, and some were reported. See docs/DECISION-HISTORY.md §2.

Scope: radiation games carrying `divergence_raw`. Their noise floor is the only
sender-facing score produced by vector retrieval, so they are the only ones the
approximate->exact switch can move.

Deliberately NOT rescored:
  - bridging `fidelity`. compute_fidelity() ranks only the 200-word sample handed
    to it, in numpy — it never went through pgvector, so exact search cannot have
    changed it. (Separately: the stored values do not reproduce under current code
    even with the old foil pool. That is a reproducibility bug of its own, not a
    migration effect, and rescoring here would paper over it.)
  - study games (alignment / parsimony / recovery_mrr) — no retrieval dependency.
  - the nine ancient divergence-only games — no divergence_raw to compare against.

Pass --include-bridging to override, once the fidelity question is settled.

Determinism. The vocabulary sample feeding the null distribution is seeded, so two
runs produce identical percentiles. One caveat: `get_noise_floor` falls back to an
LLM when vocabulary coverage is sparse, and that call is not deterministic. Games
that hit the fallback are flagged `llm_fallback: true` in the output.

Usage:
    python scripts/rescore_archive.py            # dry run, prints the diff
    python scripts/rescore_archive.py --commit   # writes sender_scores_v2
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent))

from _secrets import libpq_env, load_secrets, safe_dsn  # noqa: E402

SCORING_VERSION_V2 = "v3.1-exact"
RNG_SEED = 20260710
NULL_SAMPLES = 200


def psql_json(env, sql: str):
    r = subprocess.run(
        ["psql", "-tAc", f"select coalesce(json_agg(t), '[]'::json) from ({sql}) t;"],
        env=env, capture_output=True, text=True, timeout=120,
    )
    if r.returncode:
        sys.exit(f"query failed: {r.stderr.strip()[:400]}")
    return json.loads(r.stdout.strip() or "[]")


def in_scope(g: dict, include_bridging: bool = False) -> bool:
    s = g.get("sender_scores") or {}
    if g["game_type"] == "radiation":
        return "divergence_raw" in s
    if g["game_type"] == "bridging" and include_bridging:
        return "fidelity" in s
    return False


async def rescore_radiation(g, pool, cache, svc):
    from app.services.scoring import (
        score_radiation, compute_divergence, bootstrap_null_distribution, normalize_scores,
    )
    setup = g["setup"]
    seed_word = (setup.get("seed_word") or "").lower().strip()
    clues = [c.lower().strip() for c in (g["sender_input"] or {}).get("clues", [])]
    if not seed_word or not clues:
        return None, "no seed/clues"

    # Recompute the noise floor with exact search (this is the whole point).
    floor = await svc.get_noise_floor(None, seed_word, sense_context=setup.get("seed_sense"), k=10)
    used_llm = any(f.get("source") == "llm" for f in floor)
    floor_embs = [e.tolist() for _, e in pool.embeddings_for([f["word"] for f in floor])]
    if not floor_embs:
        return None, "no floor embeddings"

    # Same context strings the live path builds (routes/games.py).
    clue_context = ", ".join(clues)
    texts = [f"{c} (in context: {seed_word})" for c in clues]
    texts.append(f"{seed_word} (in context: {clue_context})")
    embs = await cache.get_embeddings_batch(texts)
    clue_embs, seed_emb = embs[: len(clues)], embs[len(clues)]

    scores = score_radiation(clue_embs, seed_emb)
    divergence_raw = compute_divergence(clue_embs, floor_embs)

    null_dist = bootstrap_null_distribution(
        prompt_embeddings={"seed": seed_emb},
        vocabulary_embeddings=pool.random_embeddings(NULL_SAMPLES).tolist(),
        n_clues=len(clues), instrument="radiation", n_samples=100,
    )
    pct = normalize_scores(scores, null_dist, method="percentile")["relevance_normalized"]

    return {
        "spread": scores["spread"],
        "divergence": scores["divergence"],
        "divergence_raw": divergence_raw,
        "relevance": scores["relevance"],
        "relevance_percentile": pct,
        "noise_floor": [f["word"] for f in floor],
        "llm_fallback": used_llm,
    }, None


async def rescore_bridging(g, pool, cache, svc):
    from app.services.scoring import (
        score_bridging, bootstrap_null_distribution, normalize_scores,
    )
    setup = g["setup"]
    anchor = (setup.get("anchor_word") or "").lower().strip()
    target = (setup.get("target_word") or "").lower().strip()
    clues = [c.lower().strip() for c in (g["sender_input"] or {}).get("clues", [])]
    if not anchor or not target or not clues:
        return None, "no anchor/target/clues"

    embs = await cache.get_embeddings_batch([anchor, target] + clues)
    anchor_emb, target_emb, clue_embs = embs[0], embs[1], embs[2:]

    vocab = pool.random_embeddings(NULL_SAMPLES).tolist()
    scores = score_bridging(clue_embs, anchor_emb, target_emb, vocab)

    null_dist = bootstrap_null_distribution(
        prompt_embeddings={"anchor": anchor_emb, "target": target_emb},
        vocabulary_embeddings=vocab, n_clues=len(clues), instrument="union", n_samples=100,
    )
    pct = normalize_scores(scores, null_dist, method="percentile")["relevance_normalized"]

    return {
        "fidelity": scores["fidelity"],
        "relevance": scores["relevance"],
        "relevance_percentile": pct,
        "divergence": scores["divergence"],
        "llm_fallback": False,
    }, None


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true", help="write sender_scores_v2 (default: dry run)")
    parser.add_argument("--include-bridging", action="store_true",
                        help="also rescore bridging fidelity (see module docstring — not retrieval-dependent)")
    parser.add_argument("--artifact", default=None)
    args = parser.parse_args()

    load_secrets()
    env = libpq_env()

    from app.services.cache import EmbeddingCache, VocabularyPool
    from app.services import embeddings as svc

    pool = VocabularyPool.get_instance()
    pool.initialize(Path(args.artifact) if args.artifact else None)
    cache = EmbeddingCache.get_instance()

    games = psql_json(env, """
        select id, game_type, setup, sender_input, sender_scores
        from public.games
        where sender_scores is not null and sender_input is not null
    """)
    scoped = [g for g in games if in_scope(g, args.include_bridging)]
    print(f"{len(games)} scored games; {len(scoped)} in scope "
          f"({sum(1 for g in scoped if g['game_type']=='radiation')} radiation, "
          f"{sum(1 for g in scoped if g['game_type']=='bridging')} bridging)")
    print(f"target: {safe_dsn()}   mode: {'COMMIT' if args.commit else 'DRY RUN'}\n")

    random.seed(RNG_SEED)
    np.random.seed(RNG_SEED)

    results, skipped, deltas = [], [], []
    for i, g in enumerate(scoped, 1):
        fn = rescore_radiation if g["game_type"] == "radiation" else rescore_bridging
        try:
            new, err = await fn(g, pool, cache, svc)
        except Exception as e:
            new, err = None, f"{type(e).__name__}: {e}"
        if new is None:
            skipped.append((g["id"], err))
            continue
        old = g["sender_scores"]
        key = "divergence_raw" if g["game_type"] == "radiation" else "fidelity"
        if old.get(key) is not None and new.get(key) is not None:
            deltas.append((g["game_type"], key, new[key] - old[key]))
        results.append((g["id"], new))
        if i % 20 == 0:
            print(f"  {i}/{len(scoped)}", flush=True)

    print(f"\nrescored {len(results)}, skipped {len(skipped)}")
    for gid, err in skipped[:10]:
        print(f"  skip {gid[:8]}: {err}")

    llm = sum(1 for _, n in results if n.get("llm_fallback"))
    if llm:
        print(f"\n{llm} games hit the LLM noise-floor fallback (non-deterministic; flagged in output)")

    for gt, key in (("radiation", "divergence_raw"), ("bridging", "fidelity")):
        d = np.array([x for t, k, x in deltas if t == gt and k == key])
        if d.size:
            print(f"\n{gt}.{key}: n={d.size} mean={d.mean():+.4f} median={np.median(d):+.4f} "
                  f"|median|={np.median(np.abs(d)):.4f} max|d|={np.abs(d).max():.4f}")

    if not args.commit:
        print("\nDRY RUN — nothing written. Re-run with --commit to persist.")
        return 0

    import os
    from supabase import create_client

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    written = 0
    for gid, new in results:
        client.table("games").update(
            {"sender_scores_v2": new, "scoring_version_v2": SCORING_VERSION_V2}
        ).eq("id", gid).execute()
        written += 1

    check = psql_json(env, "select count(*) as n from public.games where sender_scores_v2 is not null")
    print(f"\nwrote {written} rows; games with sender_scores_v2 = {check[0]['n']}")
    print("sender_scores untouched:",
          psql_json(env, "select count(sender_scores) as n from public.games")[0]["n"], "rows still populated")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
