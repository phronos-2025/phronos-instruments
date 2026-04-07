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
  SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY
"""

import argparse
import json
import os
import sys
import numpy as np
from supabase import create_client

# Add parent to path so we can import scoring functions
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.scoring import (
    compute_alignment,
    generate_foil_sets,
    bipartite_fit,
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
    # Fetch in batches
    all_embeddings = []
    offset = 0
    batch_size = 1000
    while True:
        result = supabase.table("vocabulary") \
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
        if len(result.data) < batch_size:
            break
    print(f"  Loaded {len(all_embeddings)} vocabulary embeddings")
    return np.array(all_embeddings, dtype=np.float32)


def fetch_study_games(supabase, slug: str) -> list[dict]:
    """Fetch all completed study games that need backfilling."""
    print(f"Fetching completed games for study '{slug}'...")
    result = supabase.table("games") \
        .select("id, game_number, sender_scores, setup") \
        .eq("study_slug", slug) \
        .eq("status", "completed") \
        .order("game_number") \
        .execute()
    games = result.data or []
    print(f"  Found {len(games)} completed games")
    return games


def fetch_study_config(supabase, slug: str) -> list[dict]:
    """Fetch study battery config."""
    result = supabase.table("studies") \
        .select("config") \
        .eq("slug", slug) \
        .single() \
        .execute()
    config = result.data.get("config", {})
    if isinstance(config, str):
        config = json.loads(config)
    battery = config.get("battery", config) if isinstance(config, dict) else config
    return battery


def get_target_embeddings(supabase, targets: list[str]) -> np.ndarray:
    """Fetch embeddings for target words."""
    embeddings = []
    for word in targets:
        result = supabase.table("vocabulary") \
            .select("embedding") \
            .eq("word", word) \
            .execute()
        if result.data:
            emb = result.data[0]["embedding"]
            if isinstance(emb, str):
                emb = json.loads(emb)
            embeddings.append(emb)
        else:
            print(f"  WARNING: target word '{word}' not found in vocabulary")
            return None
    return np.array(embeddings, dtype=np.float32)


def get_word_embeddings(supabase, words: list[str]) -> np.ndarray | None:
    """Fetch embeddings for submitted words."""
    embeddings = []
    for word in words:
        result = supabase.table("vocabulary") \
            .select("embedding") \
            .eq("word", word.lower().strip()) \
            .execute()
        if result.data:
            emb = result.data[0]["embedding"]
            if isinstance(emb, str):
                emb = json.loads(emb)
            embeddings.append(emb)
        else:
            print(f"  WARNING: word '{word}' not found in vocabulary, skipping game")
            return None
    return np.array(embeddings, dtype=np.float32)


def main():
    parser = argparse.ArgumentParser(description="Backfill alignment_display in study games")
    parser.add_argument("--apply", action="store_true", help="Actually update the database")
    parser.add_argument("--slug", default="aaai2026", help="Study slug to backfill")
    args = parser.parse_args()

    supabase = get_supabase()
    vocab_embeddings = fetch_vocab_embeddings(supabase)
    battery = fetch_study_config(supabase, args.slug)
    games = fetch_study_games(supabase, args.slug)

    # Pre-generate foil sets per target count (deterministic, same as runtime)
    foil_cache: dict[int, list[np.ndarray]] = {}

    # Build item config lookup
    item_configs = {}
    for item in battery:
        item_configs[item["item_number"]] = item

    updated = 0
    skipped = 0
    already_done = 0

    for game in games:
        game_id = game["id"]
        item_num = game["game_number"]
        scores = game.get("sender_scores") or {}
        config = item_configs.get(item_num, {})
        task = config.get("task", "")

        # Only process bridge games (they have alignment)
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

        # Get target embeddings
        targets = config.get("targets", [])
        m = config.get("m", len(targets))
        if not targets:
            print(f"  Game {game_id}: no targets in config, skipping")
            skipped += 1
            continue

        target_emb = get_target_embeddings(supabase, targets)
        if target_emb is None:
            skipped += 1
            continue

        # Get submitted words from game setup/input
        setup = game.get("setup") or {}
        sender_input = None
        # Need to fetch sender_input separately since we didn't select it
        game_full = supabase.table("games") \
            .select("sender_input") \
            .eq("id", game_id) \
            .single() \
            .execute()
        sender_input = game_full.data.get("sender_input")
        if not sender_input:
            print(f"  Game {game_id}: no sender_input, skipping")
            skipped += 1
            continue

        # Extract words from sender_input
        if isinstance(sender_input, str):
            sender_input = json.loads(sender_input)
        words = sender_input if isinstance(sender_input, list) else sender_input.get("words", sender_input.get("clues", []))
        if not words:
            print(f"  Game {game_id}: empty words, skipping")
            skipped += 1
            continue

        word_emb = get_word_embeddings(supabase, words)
        if word_emb is None:
            skipped += 1
            continue

        # Get or generate foil sets
        if m not in foil_cache:
            foil_cache[m] = generate_foil_sets(m, vocab_embeddings, k=100, seed=42)
        foil_sets = foil_cache[m]

        # Compute alignment
        alignment = compute_alignment(target_emb, word_emb, foil_sets)
        a_z = alignment["a_z"]
        a_display = alignment["a_display"]
        a_scaled = alignment["a_scaled"]

        old_alignment = scores.get("alignment")

        print(f"  Game {game_id} (item {item_num}): "
              f"a_scaled {old_alignment:.3f}->{a_scaled:.3f}, "
              f"a_z={'None' if a_z is None else f'{a_z:.2f}'}, "
              f"a_display={a_display:.1f}")

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

    print(f"\nSummary:")
    print(f"  Updated:      {updated}")
    print(f"  Already done:  {already_done}")
    print(f"  Skipped:       {skipped}")
    if not args.apply and updated > 0:
        print(f"\n  Dry run — no changes made. Run with --apply to update.")


if __name__ == "__main__":
    main()
