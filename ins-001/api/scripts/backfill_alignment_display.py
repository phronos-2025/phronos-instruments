"""
Backfill alignment_display and alignment_z in sender_scores for study games.

Games scored before the A_z update only have `alignment` (a_scaled, 0-1).
This script re-computes alignment using the same foil sets (deterministic)
and updates sender_scores with alignment_z and alignment_display.

Usage:
  # Dry run (default) — shows what would change
  python scripts/backfill_alignment_display.py

  # Apply changes
  python scripts/backfill_alignment_display.py --apply

Requires environment variables:
  SUPABASE_URL, SUPABASE_SERVICE_KEY
"""

import argparse
import json
import os
import sys
import numpy as np
from typing import Optional
from supabase import create_client

# Add parent to path so we can import scoring functions
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.scoring import (
    compute_alignment,
    generate_foil_sets,
)


def get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars")
        sys.exit(1)
    return create_client(url, key)


def fetch_vocab_embeddings(supabase) -> np.ndarray:
    """Fetch vocabulary embeddings from the database."""
    print("Fetching vocabulary embeddings...")
    all_embeddings = []
    offset = 0
    batch_size = 1000
    while True:
        result = supabase.table("vocabulary_embeddings") \
            .select("embedding") \
            .range(offset, offset + batch_size - 1) \
            .execute()
        if not result.data:
            break
        for row in result.data:
            emb = row["embedding"]
            if isinstance(emb, str):
                emb = json.loads(emb)
            all_embeddings.append(emb)
        offset += batch_size
        print(f"  ... loaded {len(all_embeddings)} so far")
        if len(result.data) < batch_size:
            break
    print(f"  Total: {len(all_embeddings)} vocabulary embeddings")
    return np.array(all_embeddings, dtype=np.float32)


def fetch_word_embedding(supabase, word: str) -> Optional[np.ndarray]:
    """Fetch embedding for a single word."""
    result = supabase.table("vocabulary_embeddings") \
        .select("embedding") \
        .eq("word", word.lower().strip()) \
        .execute()
    if not result.data:
        return None
    emb = result.data[0]["embedding"]
    if isinstance(emb, str):
        emb = json.loads(emb)
    return np.array(emb, dtype=np.float32)


def fetch_word_embeddings_batch(supabase, words: list) -> Optional[np.ndarray]:
    """Fetch embeddings for a list of words. Returns None if any word is missing."""
    embeddings = []
    for word in words:
        emb = fetch_word_embedding(supabase, word)
        if emb is None:
            return None
        embeddings.append(emb)
    return np.array(embeddings, dtype=np.float32)


def main():
    parser = argparse.ArgumentParser(description="Backfill alignment_display in study games")
    parser.add_argument("--apply", action="store_true", help="Actually update the database")
    parser.add_argument("--slug", default="aaai2026", help="Study slug to backfill")
    args = parser.parse_args()

    supabase = get_supabase()
    vocab_embeddings = fetch_vocab_embeddings(supabase)

    # Fetch study config
    print(f"\nFetching study config for '{args.slug}'...")
    study_result = supabase.table("studies") \
        .select("config") \
        .eq("slug", args.slug) \
        .single() \
        .execute()
    config = study_result.data.get("config", {})
    if isinstance(config, str):
        config = json.loads(config)
    battery = config.get("battery", config) if isinstance(config, dict) else config

    item_configs = {}
    for item in battery:
        item_configs[item["item_number"]] = item

    # Fetch all completed games with sender_input
    print("Fetching completed games...")
    games = supabase.table("games") \
        .select("id, game_number, sender_scores, sender_input") \
        .eq("study_slug", args.slug) \
        .eq("status", "completed") \
        .order("game_number") \
        .execute()
    games_data = games.data or []
    print(f"  Found {len(games_data)} completed games")

    # Pre-generate foil sets per target count (deterministic, same as runtime)
    foil_cache = {}

    updated = 0
    skipped = 0
    already_done = 0
    errors = 0

    for game in games_data:
        game_id = game["id"]
        item_num = game["game_number"]
        scores = game.get("sender_scores") or {}
        config = item_configs.get(item_num, {})
        task = config.get("task", "")

        # Only process bridge games (they have foil-based alignment)
        if task != "bridge":
            skipped += 1
            continue

        # Check if already has alignment_display
        if scores.get("alignment_display") is not None:
            already_done += 1
            continue

        if scores.get("alignment") is None:
            skipped += 1
            continue

        # Get targets from config
        targets = config.get("targets", [])
        m = config.get("m", len(targets))
        if not targets:
            print(f"  Game {game_id[:8]}...: no targets in config, skipping")
            skipped += 1
            continue

        # Get target embeddings
        target_emb = fetch_word_embeddings_batch(supabase, targets)
        if target_emb is None:
            print(f"  Game {game_id[:8]}...: missing target embedding, skipping")
            errors += 1
            continue

        # Get submitted words from sender_input
        sender_input = game.get("sender_input")
        if not sender_input:
            print(f"  Game {game_id[:8]}...: no sender_input, skipping")
            skipped += 1
            continue
        if isinstance(sender_input, str):
            sender_input = json.loads(sender_input)

        # Extract clues/words
        if isinstance(sender_input, list):
            words = sender_input
        elif isinstance(sender_input, dict):
            words = sender_input.get("clues", sender_input.get("words", []))
        else:
            print(f"  Game {game_id[:8]}...: unknown sender_input format, skipping")
            skipped += 1
            continue

        if not words:
            print(f"  Game {game_id[:8]}...: empty words, skipping")
            skipped += 1
            continue

        # Get word embeddings
        word_emb = fetch_word_embeddings_batch(supabase, words)
        if word_emb is None:
            print(f"  Game {game_id[:8]}...: missing word embedding for {words}, skipping")
            errors += 1
            continue

        # Get or generate foil sets
        if m not in foil_cache:
            print(f"  Generating foil sets for m={m}...")
            foil_cache[m] = generate_foil_sets(m, vocab_embeddings, k=100, seed=42)
        foil_sets = foil_cache[m]

        # Compute alignment
        alignment = compute_alignment(target_emb, word_emb, foil_sets)
        a_z = alignment["a_z"]
        a_display = alignment["a_display"]
        a_scaled = alignment["a_scaled"]
        old_alignment = scores.get("alignment")

        print(f"  Item {item_num} | {game_id[:8]}... | "
              f"a_scaled: {old_alignment:.3f} -> {a_scaled:.3f} | "
              f"a_z: {f'{a_z:.2f}' if a_z is not None else 'None'} | "
              f"a_display: {a_display:.1f}")

        if args.apply:
            new_scores = {**scores}
            new_scores["alignment"] = a_scaled
            new_scores["alignment_z"] = a_z
            new_scores["alignment_display"] = round(a_display, 1)
            supabase.table("games") \
                .update({"sender_scores": new_scores}) \
                .eq("id", game_id) \
                .execute()

        updated += 1

    print(f"\n{'=' * 50}")
    print(f"Summary for study '{args.slug}':")
    print(f"  Would update:  {updated}")
    print(f"  Already done:  {already_done}")
    print(f"  Skipped:       {skipped} (non-bridge or no alignment)")
    print(f"  Errors:        {errors} (missing embeddings)")
    if not args.apply and updated > 0:
        print(f"\n  DRY RUN — no changes made. Run with --apply to update.")
    elif args.apply:
        print(f"\n  APPLIED — {updated} games updated.")


if __name__ == "__main__":
    main()
