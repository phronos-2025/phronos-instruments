"""
Export vocabulary_embeddings to a static .npy artifact - INS-001

Replaces the pgvector table with a file the API memory-maps at startup. Run this
once, publish the output as a GitHub Release asset, then let the API fetch it at
build time.

Emits into --out:
    vocab_words.json        ordered word list, index i <-> row i of the matrix
    vocab_embeddings.npy    float32 (N, 1536), row-normalised
    vocab_meta.json         count, dims, dtype, sha256, source model

The stored embeddings are already L2-normalised (verified against the live table),
so cosine similarity is a plain dot product. This script asserts that rather than
assuming it.

Do NOT reuse analytics/notebooks/data/openai_embeddings.npy: it holds 29,426 rows
against the live table's 30,000, and its row order is not guaranteed to match
vocab_words.json.

Usage:
    python scripts/export_vocab_artifact.py [--out DIR] [--dtype float32|float16]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from dotenv import load_dotenv

PAGE_SIZE = 1000  # PostgREST hard cap; requesting more silently returns 1000
DIMS = 1536


def load_env() -> tuple:
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


def total_rows(url: str, key: str) -> int:
    req = urllib.request.Request(
        f"{url}/rest/v1/vocabulary_embeddings?select=word&limit=1",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Prefer": "count=exact"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return int(resp.headers["content-range"].split("/")[-1])


def fetch_page(url: str, key: str, offset: int) -> list:
    # order=word gives a stable total order across pages (word is the PK).
    path = (
        f"vocabulary_embeddings?select=word,embedding"
        f"&order=word&offset={offset}&limit={PAGE_SIZE}"
    )
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.load(resp)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(Path.home() / "Documents" / "phronos-backups" / "vocab-artifact"))
    parser.add_argument("--dtype", choices=["float32", "float16"], default="float32")
    args = parser.parse_args()

    url, key = load_env()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    n = total_rows(url, key)
    print(f"vocabulary_embeddings: {n} rows x {DIMS} dims -> {args.dtype}")
    print(f"artifact size: {n * DIMS * (4 if args.dtype == 'float32' else 2) / 1e6:.1f} MB\n")

    matrix = np.zeros((n, DIMS), dtype=np.float32)
    words: list = []
    started = time.time()

    for offset in range(0, n, PAGE_SIZE):
        page = fetch_page(url, key, offset)
        if not page:
            break
        for i, row in enumerate(page):
            emb = row["embedding"]
            if isinstance(emb, str):
                emb = json.loads(emb)
            if len(emb) != DIMS:
                sys.exit(f"row {offset + i} ({row['word']!r}) has {len(emb)} dims, expected {DIMS}")
            matrix[offset + i] = emb
            words.append(row["word"])
        elapsed = time.time() - started
        done = min(offset + PAGE_SIZE, n)
        print(f"  {done:>6}/{n}  {elapsed:5.1f}s", flush=True)

    if len(words) != n:
        sys.exit(f"fetched {len(words)} rows, expected {n} — pagination lost rows")
    if len(set(words)) != n:
        sys.exit("duplicate words in export — order=word did not give a stable page order")

    # Assert the invariant the runtime relies on: cosine == dot product.
    norms = np.linalg.norm(matrix, axis=1)
    print(f"\nL2 norms: min={norms.min():.6f} max={norms.max():.6f} mean={norms.mean():.6f}")
    if not np.allclose(norms, 1.0, atol=1e-3):
        sys.exit("embeddings are NOT unit-normalised — the dot-product shortcut is invalid")

    if args.dtype == "float16":
        as16 = matrix.astype(np.float16)
        err = float(np.max(np.abs(as16.astype(np.float32) - matrix)))
        print(f"float16 max component error: {err:.2e}")
        matrix = as16

    npy = out / "vocab_embeddings.npy"
    np.save(npy, matrix)
    (out / "vocab_words.json").write_text(json.dumps(words))

    sha = hashlib.sha256(npy.read_bytes()).hexdigest()
    meta = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "count": n,
        "dims": DIMS,
        "dtype": args.dtype,
        "normalised": True,
        "sha256": sha,
        "embedding_model": "text-embedding-3-small",
        "source": f"{url}/rest/v1/vocabulary_embeddings",
    }
    (out / "vocab_meta.json").write_text(json.dumps(meta, indent=1))

    print(f"\nWrote {out}")
    print(f"  vocab_embeddings.npy  {npy.stat().st_size / 1e6:.1f} MB")
    print(f"  sha256 {sha}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
