"""
Vector parity harness - INS-001

BLOCKING GATE. Run before dropping `vocabulary_embeddings`.

The live noise floor comes from an approximate ivfflat scan (lists=100, one probe
=> ~1% of vectors examined). The replacement is an exact numpy scan. They do not
return the same neighbours, and the noise floor feeds `divergence`. This script
measures how much that actually moves the science.

Part A - retrieval parity
    N random seeds; ivfflat RPC top-k vs exact top-k. Reports overlap and the
    similarity the approximate scan left on the table.

Part B - score impact
    For every archived radiation game that stored its noise floor, recompute
    `divergence_raw` against (a) the stored floor and (b) the exact floor, holding
    clue embeddings fixed. This is the number that decides whether new games stay
    comparable to the 193 already collected.

Clue and seed embeddings are read from the artifact rather than OpenAI, so the run
is free, deterministic, and isolates the retrieval change as the only variable.

Usage:
    python scripts/parity_check.py [--seeds 200] [--backup DIR] [--artifact DIR]
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import urllib.request
from pathlib import Path

import numpy as np
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))

FLOOR_K = 10  # games.py:234 calls get_noise_floor(k=10)
FETCH_K = FLOOR_K * 2  # embeddings.py: fetch_k = k * 2


def load_env():
    env_file = os.environ.get("ENV_FILE")
    if env_file:
        load_dotenv(env_file)
    else:
        local = Path(__file__).parent.parent / ".env"
        secrets = Path.home() / "Documents" / "Secrets" / "instruments-keys.env"
        load_dotenv(local if local.exists() else secrets)
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return url.rstrip("/"), key


def ivfflat_nearest(url, key, emb, seed_word, k):
    """The RPC being replaced. Returns [(word, similarity)]."""
    body = json.dumps(
        {"seed_embedding": json.dumps(list(map(float, emb))), "seed_word": seed_word, "k": k}
    ).encode()
    req = urllib.request.Request(
        f"{url}/rest/v1/rpc/get_noise_floor_by_embedding",
        data=body,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return [(r["word"], r["similarity"]) for r in json.load(resp)]


def divergence_raw(clue_embs: np.ndarray, floor_embs: np.ndarray) -> float:
    """Mirror of scoring.compute_divergence: 1 - mean cos(clue, floor_centroid)."""
    if clue_embs.size == 0 or floor_embs.size == 0:
        return 0.0
    centroid = floor_embs.mean(axis=0)
    cn = np.linalg.norm(centroid)
    if cn == 0:
        return 0.0
    sims = (clue_embs @ centroid) / (np.linalg.norm(clue_embs, axis=1) * cn)
    return float(max(0.0, min(1.0, 1.0 - sims.mean())))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seeds", type=int, default=200)
    parser.add_argument("--artifact", default=str(Path.home() / "Documents" / "phronos-backups" / "vocab-artifact"))
    parser.add_argument("--backup", default=None, help="Backup dir containing games.json")
    args = parser.parse_args()

    url, key = load_env()

    from app.services.cache.vocabulary_pool import VocabularyPool
    from app.services.embeddings import _is_semantically_meaningful

    pool = VocabularyPool.get_instance()
    pool.initialize(Path(args.artifact))

    def pipeline_floor(nearest_pairs, seed_word, k=FLOOR_K):
        """Apply the same semantic filter the real pipeline applies."""
        kept = [
            (w, s) for w, s in nearest_pairs if _is_semantically_meaningful(seed_word, w, s)
        ]
        return kept[:k]

    # ---------------------------------------------------------------- Part A
    print(f"Part A - retrieval parity, {args.seeds} random seeds, top-{FETCH_K}\n")
    random.seed(20260710)
    seeds = random.sample(pool._words, args.seeds)

    overlaps, top1_match, sim_gaps = [], 0, []
    for i, seed in enumerate(seeds):
        emb = pool.embedding_for(seed)
        approx = ivfflat_nearest(url, key, emb, seed, FETCH_K)
        exact = pool.nearest(emb, k=FETCH_K, exclude=[seed])

        aw = [w for w, _ in approx]
        ew = [w for w, _ in exact]
        overlaps.append(len(set(aw) & set(ew)) / max(len(ew), 1))
        if aw and ew and aw[0] == ew[0]:
            top1_match += 1
        if approx and exact:
            sim_gaps.append(exact[0][1] - approx[0][1])

        if (i + 1) % 50 == 0:
            print(f"  {i + 1}/{args.seeds}  running overlap={np.mean(overlaps):.3f}", flush=True)

    ov = np.array(overlaps)
    print(f"\n  overlap@{FETCH_K}:  mean={ov.mean():.3f}  median={np.median(ov):.3f}  min={ov.min():.3f}")
    print(f"  top-1 identical:  {top1_match}/{args.seeds} ({100*top1_match/args.seeds:.0f}%)")
    print(f"  best-sim missed by ivfflat: mean={np.mean(sim_gaps):+.4f}  max={np.max(sim_gaps):+.4f}")
    print(f"  seeds where ivfflat found a strictly worse #1: {sum(1 for g in sim_gaps if g > 1e-6)}")

    # ---------------------------------------------------------------- Part B
    backup = args.backup
    if not backup:
        root = Path.home() / "Documents" / "phronos-backups"
        dirs = sorted(d for d in root.iterdir() if (d / "games.json").exists())
        backup = dirs[-1] if dirs else None
    if not backup:
        print("\nPart B skipped: no backup with games.json found")
        return 0

    games = json.loads((Path(backup) / "games.json").read_text())
    rad = [
        g for g in games
        if g["game_type"] == "radiation"
        and (g.get("setup") or {}).get("noise_floor")
        and (g.get("sender_input") or {}).get("clues")
    ]

    print(f"\n\nPart B - divergence impact on {len(rad)} archived radiation games")
    print("  (clue embeddings held fixed; only the noise floor changes)\n")

    deltas, floor_overlaps, skipped = [], [], 0
    for g in rad:
        seed = (g["setup"].get("seed_word") or "").lower().strip()
        clues = [c.lower().strip() for c in g["sender_input"]["clues"]]
        seed_emb = pool.embedding_for(seed)
        clue_pairs = pool.embeddings_for(clues)
        if seed_emb is None or len(clue_pairs) < len(clues):
            skipped += 1
            continue

        clue_embs = np.array([e for _, e in clue_pairs], dtype=np.float32)

        stored_words = [f["word"] for f in g["setup"]["noise_floor"]]
        stored_pairs = pool.embeddings_for(stored_words)
        if not stored_pairs:
            skipped += 1
            continue
        stored_embs = np.array([e for _, e in stored_pairs], dtype=np.float32)

        exact = pipeline_floor(pool.nearest(seed_emb, k=FETCH_K, exclude=[seed]), seed)
        exact_embs = np.array([e for _, e in pool.embeddings_for([w for w, _ in exact])], dtype=np.float32)
        if exact_embs.size == 0:
            skipped += 1
            continue

        d_old = divergence_raw(clue_embs, stored_embs)
        d_new = divergence_raw(clue_embs, exact_embs)
        deltas.append(d_new - d_old)
        floor_overlaps.append(
            len(set(stored_words) & {w for w, _ in exact}) / max(len(stored_words), 1)
        )

    if not deltas:
        print(f"  no comparable games (skipped {skipped})")
        return 0

    d = np.abs(np.array(deltas))
    fo = np.array(floor_overlaps)
    print(f"  games compared: {len(deltas)}  (skipped {skipped}: seed/clues outside vocabulary)")
    print(f"  noise-floor word overlap (stored vs exact): mean={fo.mean():.3f} median={np.median(fo):.3f}")
    print(f"  |delta divergence_raw|: mean={d.mean():.4f}  median={np.median(d):.4f}  p95={np.percentile(d,95):.4f}  max={d.max():.4f}")
    print(f"  signed mean: {np.mean(deltas):+.4f}  (>0 means exact search raises divergence)")
    print(f"\n  For scale: stored divergence_raw values run ~0.20-0.35.")
    print(f"  A median |delta| of {np.median(d):.4f} is {100*np.median(d)/0.275:.1f}% of a typical score.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
