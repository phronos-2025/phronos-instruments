"""
Scoring Algorithms - INS-001.2 Semantic Union (Bridging)

This module provides:
1. Re-exports of unified scoring functions from scoring.py for INS-001.2
2. Utility functions specific to bridging (lexical union finder, morphological helpers)
3. Backwards-compatible deprecated stubs for old function signatures

For the unified scoring framework, see scoring.py which contains:
- cosine_similarity(): Core building block
- calculate_divergence(): DAT-style mean pairwise distance (0-100 scale)
- score_union(): Combined relevance + divergence scoring for INS-001.2
- bootstrap_null_distribution(): Null distribution generation
- normalize_scores(): Score normalization (percentile/z-score)
- compare_submissions(): Compare participant vs baseline
"""

import warnings
import numpy as np
from typing import Optional

# Re-export unified scoring functions from scoring.py
from .scoring import (
    cosine_similarity,
    calculate_divergence,
    score_union,
    bootstrap_null_distribution,
    normalize_scores,
    compare_submissions,
    get_relevance_interpretation,
    get_divergence_interpretation,
    RELEVANCE_THRESHOLD,
)


# ============================================
# UTILITY FUNCTIONS (Morphological Filtering)
# ============================================

def _get_word_stem(word: str) -> str:
    """
    Get a simple stem for morphological variant detection.

    Uses a basic approach: strip common suffixes to detect
    plurals, verb forms, and other variants.
    """
    word = word.lower()

    # Common suffixes to strip (order matters - check longer ones first)
    suffixes = [
        'ically', 'ation', 'ness', 'ment', 'able', 'ible', 'tion',
        'sion', 'ally', 'ful', 'less', 'ing', 'ity', 'ous', 'ive',
        'est', 'ier', 'ies', 'ied', 'ly', 'ed', 'er', 'en', 'es', 's'
    ]

    for suffix in suffixes:
        if word.endswith(suffix) and len(word) > len(suffix) + 2:
            return word[:-len(suffix)]

    return word


def _is_morphological_variant(word1: str, word2: str) -> bool:
    """
    Check if two words are morphological variants of each other.

    Examples: catalyst/catalysts, run/running, happy/happiness
    """
    w1, w2 = word1.lower(), word2.lower()

    # Exact match
    if w1 == w2:
        return True

    # One is substring of the other (catches most plurals/verb forms)
    if w1.startswith(w2) or w2.startswith(w1):
        # But not if they're very different lengths (e.g., "cat" vs "catalyst")
        if abs(len(w1) - len(w2)) <= 4:
            return True

    # Same stem
    if _get_word_stem(w1) == _get_word_stem(w2):
        return True

    return False


# ============================================
# LEXICAL UNION FINDER (LLM Baseline)
# ============================================

async def find_lexical_union(
    anchor: str,
    target: str,
    num_concepts: int,
    supabase
) -> list[str]:
    """
    Find vocabulary words with high semantic relevance to BOTH anchor and target.

    Uses joint similarity scoring: words must relate strongly to both concepts,
    not just sit at a geometric midpoint. This produces semantically meaningful
    unions rather than superficial pattern matches (e.g., names near names).

    Scoring: For each candidate word, calculate:
    - sim_anchor = cosine_similarity(word_vec, anchor_vec)
    - sim_target = cosine_similarity(word_vec, target_vec)
    - joint_score = min(sim_anchor, sim_target)  # Must connect to BOTH

    Return the N words with highest joint similarity scores.

    Args:
        anchor: The anchor concept
        target: The target concept
        num_concepts: Number of union concepts (n = # used by participant)
        supabase: Authenticated Supabase client

    Returns:
        List of union words (unordered set, but returned as list)
    """
    from .embeddings import get_embeddings_batch

    # Get anchor and target embeddings
    embeddings = await get_embeddings_batch([anchor, target])
    anchor_vec = np.array(embeddings[0])
    target_vec = np.array(embeddings[1])

    # Get candidates near both anchor and target regions
    # Query from both ends to ensure we have words relevant to each concept
    anchor_result = supabase.rpc(
        "get_noise_floor_by_embedding",
        {
            "seed_embedding": anchor_vec.tolist(),
            "seed_word": anchor,
            "k": 150
        }
    ).execute()

    target_result = supabase.rpc(
        "get_noise_floor_by_embedding",
        {
            "seed_embedding": target_vec.tolist(),
            "seed_word": target,
            "k": 150
        }
    ).execute()

    if not anchor_result.data and not target_result.data:
        return []

    # Combine candidates from both queries, deduplicating by word
    candidate_words_set = set()
    candidate_words = []
    for r in (anchor_result.data or []) + (target_result.data or []):
        word = r["word"]
        if word not in candidate_words_set:
            candidate_words_set.add(word)
            candidate_words.append(word)

    if not candidate_words:
        return []

    # Get embeddings for all candidates in one batch
    candidate_embeddings = await get_embeddings_batch(candidate_words)

    # Track used words for morphological variant detection
    used_words = [anchor.lower(), target.lower()]

    # Score each candidate by joint similarity (must relate to BOTH concepts)
    scored_candidates = []
    for word, emb in zip(candidate_words, candidate_embeddings):
        if _is_morphological_variant(word, anchor) or _is_morphological_variant(word, target):
            continue

        word_vec = np.array(emb)

        # Cosine similarity to both anchor and target
        sim_anchor = cosine_similarity(word_vec.tolist(), anchor_vec.tolist())
        sim_target = cosine_similarity(word_vec.tolist(), target_vec.tolist())

        # Joint relevance: word must connect meaningfully to BOTH concepts
        # Using min() ensures we don't get words that are very close to one
        # concept but irrelevant to the other
        joint_score = min(sim_anchor, sim_target)

        scored_candidates.append((word, joint_score, sim_anchor, sim_target))

    # Sort by joint score (descending) and select top N, avoiding morphological variants
    scored_candidates.sort(key=lambda x: x[1], reverse=True)

    union_words = []
    for word, joint_score, sim_a, sim_t in scored_candidates:
        # Skip if morphological variant of already selected word
        is_variant = any(_is_morphological_variant(word, used) for used in used_words)
        if is_variant:
            continue

        union_words.append(word)
        used_words.append(word.lower())

        if len(union_words) >= num_concepts:
            break

    return union_words


# Keep old function name as alias for backwards compatibility
async def find_lexical_bridge(
    anchor: str,
    target: str,
    num_steps: int,
    supabase
) -> list[str]:
    """
    Alias for find_lexical_union for backwards compatibility.

    Deprecated: Use find_lexical_union instead.
    """
    return await find_lexical_union(anchor, target, num_steps, supabase)


# ============================================
# DEPRECATED FUNCTIONS (Backwards Compatibility)
# ============================================
# These functions are deprecated and will be removed in a future version.
# They are kept here for backwards compatibility with existing code.

# Old calibration constants (kept for compatibility)
CALIBRATION_MAX = 0.8
JOINT_DISTANCE_MAX_DIFF = 1.5


def calculate_binding_strength(
    anchor_embedding: list[float],
    target_embedding: list[float],
    clue_embeddings: list[list[float]]
) -> float:
    """
    DEPRECATED: Use score_union() from scoring.py instead.

    Calculate binding strength using the old min-based approach.
    This is superseded by relevance (mean-based approach).
    """
    warnings.warn(
        "calculate_binding_strength is deprecated. Use score_union from scoring.py instead.",
        DeprecationWarning,
        stacklevel=2
    )

    if not clue_embeddings:
        return 0.0

    joint_scores = []
    for clue_emb in clue_embeddings:
        sim_anchor = cosine_similarity(clue_emb, anchor_embedding)
        sim_target = cosine_similarity(clue_emb, target_embedding)
        joint = min(sim_anchor, sim_target)
        joint_scores.append(joint)

    mean_joint = np.mean(joint_scores)
    normalized_score = min(100.0, (mean_joint / 0.6) * 100)
    return float(max(0.0, normalized_score))


def calculate_reconstruction(
    true_anchor_embedding: list[float],
    true_target_embedding: list[float],
    guessed_anchor_embedding: list[float],
    guessed_target_embedding: list[float],
    true_anchor: str,
    true_target: str,
    guessed_anchor: str,
    guessed_target: str
) -> dict:
    """
    DEPRECATED: Not used in INS-001.2 scoring.

    Calculate reconstruction accuracy for backwards compatibility.
    """
    warnings.warn(
        "calculate_reconstruction is deprecated and not used in INS-001.2.",
        DeprecationWarning,
        stacklevel=2
    )

    FUZZY_EXACT_MATCH_THRESHOLD = 0.99

    true_a = np.array(true_anchor_embedding)
    true_t = np.array(true_target_embedding)
    guess_a = np.array(guessed_anchor_embedding)
    guess_t = np.array(guessed_target_embedding)

    # Calculate similarities for both orderings
    sim_a1 = cosine_similarity(guess_a.tolist(), true_a.tolist())
    sim_t1 = cosine_similarity(guess_t.tolist(), true_t.tolist())
    score_ordering1 = (sim_a1 + sim_t1) / 2

    sim_a2 = cosine_similarity(guess_a.tolist(), true_t.tolist())
    sim_t2 = cosine_similarity(guess_t.tolist(), true_a.tolist())
    score_ordering2 = (sim_a2 + sim_t2) / 2

    if score_ordering1 >= score_ordering2:
        best_score = score_ordering1
        anchor_sim = sim_a1
        target_sim = sim_t1
        order_swapped = False
    else:
        best_score = score_ordering2
        anchor_sim = sim_a2
        target_sim = sim_t2
        order_swapped = True

    overall_pct = max(0.0, best_score) * 100
    anchor_pct = max(0.0, anchor_sim) * 100
    target_pct = max(0.0, target_sim) * 100

    true_anchor_lower = true_anchor.lower().strip()
    true_target_lower = true_target.lower().strip()
    guessed_anchor_lower = guessed_anchor.lower().strip()
    guessed_target_lower = guessed_target.lower().strip()

    if order_swapped:
        exact_anchor_match = (
            guessed_anchor_lower == true_target_lower or
            anchor_sim > FUZZY_EXACT_MATCH_THRESHOLD
        )
        exact_target_match = (
            guessed_target_lower == true_anchor_lower or
            target_sim > FUZZY_EXACT_MATCH_THRESHOLD
        )
    else:
        exact_anchor_match = (
            guessed_anchor_lower == true_anchor_lower or
            anchor_sim > FUZZY_EXACT_MATCH_THRESHOLD
        )
        exact_target_match = (
            guessed_target_lower == true_target_lower or
            target_sim > FUZZY_EXACT_MATCH_THRESHOLD
        )

    return {
        "overall": float(overall_pct),
        "anchor_similarity": float(anchor_pct),
        "target_similarity": float(target_pct),
        "order_swapped": order_swapped,
        "exact_anchor_match": exact_anchor_match,
        "exact_target_match": exact_target_match
    }


def calculate_bridge_similarity(
    sender_clue_embeddings: list[list[float]],
    recipient_clue_embeddings: list[list[float]],
    anchor_embedding: list[float] | None = None,
    target_embedding: list[float] | None = None
) -> dict:
    """
    DEPRECATED: Use compare_submissions() from scoring.py instead.

    Compare two sets of clues for backwards compatibility.
    """
    warnings.warn(
        "calculate_bridge_similarity is deprecated. Use compare_submissions from scoring.py instead.",
        DeprecationWarning,
        stacklevel=2
    )

    if not sender_clue_embeddings or not recipient_clue_embeddings:
        return {
            "overall": 0.0,
            "centroid_similarity": 0.0,
            "path_alignment": None
        }

    sender_vecs = [np.array(e) for e in sender_clue_embeddings]
    recipient_vecs = [np.array(e) for e in recipient_clue_embeddings]

    sender_centroid = np.mean(sender_vecs, axis=0)
    recipient_centroid = np.mean(recipient_vecs, axis=0)

    centroid_sim = cosine_similarity(sender_centroid.tolist(), recipient_centroid.tolist())
    centroid_sim_pct = max(0.0, centroid_sim) * 100

    path_alignment = None
    if anchor_embedding is not None and target_embedding is not None:
        anchor_vec = np.array(anchor_embedding)
        target_vec = np.array(target_embedding)
        line_dir = target_vec - anchor_vec
        line_len_sq = np.dot(line_dir, line_dir)

        if line_len_sq > 1e-10:
            def get_perpendicular(centroid):
                proj_scalar = np.dot(centroid - anchor_vec, line_dir) / line_len_sq
                proj_point = anchor_vec + proj_scalar * line_dir
                return centroid - proj_point

            sender_perp = get_perpendicular(sender_centroid)
            recipient_perp = get_perpendicular(recipient_centroid)

            sender_perp_norm = np.linalg.norm(sender_perp)
            recipient_perp_norm = np.linalg.norm(recipient_perp)

            if sender_perp_norm > 1e-10 and recipient_perp_norm > 1e-10:
                path_alignment = float(
                    np.dot(sender_perp, recipient_perp) /
                    (sender_perp_norm * recipient_perp_norm)
                )

    return {
        "overall": float(centroid_sim_pct),
        "centroid_similarity": float(centroid_sim_pct),
        "path_alignment": path_alignment
    }


def calculate_semantic_distance(
    embedding1: list[float],
    embedding2: list[float]
) -> float:
    """
    DEPRECATED: Trivial transform of cosine_similarity.

    Calculate semantic distance between two embeddings.
    """
    warnings.warn(
        "calculate_semantic_distance is deprecated. Use cosine_similarity instead.",
        DeprecationWarning,
        stacklevel=2
    )

    sim = cosine_similarity(embedding1, embedding2)
    distance = (1 - sim) * 50
    return float(max(0.0, min(100.0, distance)))


def calculate_statistical_baseline(
    clue_embeddings: list[list[float]],
    true_anchor: str,
    true_target: str,
    true_anchor_embedding: list[float],
    true_target_embedding: list[float],
    vocabulary: list[tuple[str, list[float]]],
    top_k: int = 100
) -> dict:
    """
    DEPRECATED: Complex baseline calculation not used in INS-001.2.

    Returns a stub result for backwards compatibility.
    """
    warnings.warn(
        "calculate_statistical_baseline is deprecated and not used in INS-001.2.",
        DeprecationWarning,
        stacklevel=2
    )

    return {
        "guessed_anchor": None,
        "guessed_target": None,
        "reconstruction_score": 0.0,
        "method": "deprecated"
    }


def get_reconstruction_interpretation(score: float) -> str:
    """
    DEPRECATED: Not used in INS-001.2.

    Get interpretation of reconstruction score for backwards compatibility.
    """
    warnings.warn(
        "get_reconstruction_interpretation is deprecated and not used in INS-001.2.",
        DeprecationWarning,
        stacklevel=2
    )

    if score < 40:
        return "Opaque"
    elif score < 60:
        return "Partial"
    elif score < 80:
        return "Good"
    else:
        return "Transparent"


# ============================================
# TEST CASES - Run with pytest
# ============================================

def test_morphological_variants():
    """Test morphological variant detection."""
    assert _is_morphological_variant("cat", "cats") == True
    assert _is_morphological_variant("run", "running") == True
    assert _is_morphological_variant("happy", "happiness") == True
    assert _is_morphological_variant("cat", "dog") == False
    assert _is_morphological_variant("cat", "catalyst") == False  # Too different in length


def test_word_stem():
    """Test word stemming."""
    assert _get_word_stem("running") == "runn"
    assert _get_word_stem("cats") == "cat"
    assert _get_word_stem("happiness") == "happi"


if __name__ == "__main__":
    test_morphological_variants()
    test_word_stem()
    print("All tests passed!")
