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


def _normalize_stem(word: str) -> str:
    """
    Normalize a word stem for comparison, handling Y→I transformations.

    This handles cases like:
    - mystery → myster
    - mysteries → myster (strips 'ies')
    - mysterious → myster (strips 'ous', then 'i')
    - mysteriously → myster (strips 'ly', strips 'ous', then 'i')

    Uses limited recursion for compound suffixes like "-ously" = "-ous" + "-ly"
    """
    stem = word.lower()

    # First pass: strip main suffix
    stem = _get_word_stem(stem)

    # Second pass: handle compound suffixes (e.g., mysteriously -> mysterious -> mysteri)
    # Only do one more pass to avoid over-stemming (myster -> myst)
    second_stem = _get_word_stem(stem)
    # Only accept second stemming if it ends in 'i' (indicating y→i transformation)
    if second_stem.endswith('i'):
        stem = second_stem

    # Normalize y/i endings for comparison
    # mystery → myster, mysteri → myster, myster → myster
    if stem.endswith('y'):
        return stem[:-1]
    if stem.endswith('i'):
        return stem[:-1]

    return stem


def _strip_common_prefixes(word: str) -> str:
    """
    Strip common morphological prefixes from a word.

    Handles negation/modification prefixes like un-, in-, dis-, etc.
    """
    word = word.lower()

    # Common prefixes (order by length, longest first)
    prefixes = [
        'counter', 'under', 'over', 'anti', 'dis', 'mis', 'non',
        'pre', 'un', 'in', 'im', 're'
    ]

    for prefix in prefixes:
        if word.startswith(prefix) and len(word) > len(prefix) + 3:
            return word[len(prefix):]

    return word


def _is_morphological_variant(word1: str, word2: str) -> bool:
    """
    Check if two words are morphological variants of each other.

    Examples:
    - catalyst/catalysts (plural)
    - run/running (verb form)
    - happy/happiness (derivation)
    - mystery/mysteries (y→ie plural)
    - mystery/mysterious (y→i derivation)
    - mystery/mysteriously (chained suffixes)
    - certainty/uncertainty (prefix)
    - certainty/uncertain (prefix + suffix difference)
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

    # Get prefix-stripped versions
    w1_stripped = _strip_common_prefixes(w1)
    w2_stripped = _strip_common_prefixes(w2)

    # Check prefix-based variants (certainty/uncertainty)
    if w1_stripped == w2_stripped:
        return True
    if w1_stripped == w2 or w2_stripped == w1:
        return True

    # Get normalized stems for all versions
    stem1 = _normalize_stem(w1)
    stem2 = _normalize_stem(w2)
    stem1_stripped = _normalize_stem(w1_stripped)
    stem2_stripped = _normalize_stem(w2_stripped)

    # Same normalized stem (handles y→i transformations like mystery/mysteries/mysterious)
    if stem1 == stem2:
        return True

    # Check normalized stems of prefix-stripped versions
    if stem1_stripped == stem2_stripped:
        return True

    # Cross-check: stripped version matches other's stem (uncertain vs certainty)
    # uncertain -> certain (stripped), certainty -> certain (stem)
    if w1_stripped == stem2 or w2_stripped == stem1:
        return True
    if stem1_stripped == stem2 or stem2_stripped == stem1:
        return True

    # Check if one stripped version is substring of the other (within length limit)
    if w1_stripped.startswith(w2_stripped) or w2_stripped.startswith(w1_stripped):
        if abs(len(w1_stripped) - len(w2_stripped)) <= 4:
            return True

    return False


# ============================================
# STATISTICAL UNION FINDER (Database Function)
# ============================================

async def find_lexical_union(
    anchor: str,
    target: str,
    num_concepts: int,
    supabase
) -> list[str]:
    """
    Find vocabulary words with minimum total embedding distance to both A and T.

    Full vocabulary scan done server-side via database function for performance.
    This finds words in the intersection of neighborhoods around both endpoints.

    Scoring: For each word in vocabulary, calculate:
    - score = sim_anchor + sim_target  (equivalently: mean(sim_a, sim_t))

    This finds words that minimize total distance to both endpoints.

    Args:
        anchor: The anchor concept
        target: The target concept
        num_concepts: Number of union concepts (n = # used by participant)
        supabase: Authenticated Supabase client

    Returns:
        List of union words (unordered set, but returned as list)
    """
    import json
    from .embeddings import get_embeddings_batch

    # Get anchor and target embeddings
    embeddings = await get_embeddings_batch([anchor, target])
    anchor_emb = embeddings[0]
    target_emb = embeddings[1]

    # Request more candidates than needed to allow for filtering
    # (morphological variants, anchor/target themselves)
    k = num_concepts * 3 + 10

    try:
        # Use database function for fast server-side scoring
        result = supabase.rpc(
            "get_statistical_union",
            {
                "anchor_embedding": json.dumps(anchor_emb),
                "target_embedding": json.dumps(target_emb),
                "k": k
            }
        ).execute()

        if not result.data:
            return []

        # Filter results for morphological variants
        used_words = [anchor.lower(), target.lower()]
        union_words = []

        for row in result.data:
            word = row["word"]

            # Skip anchor/target
            if word.lower() == anchor.lower() or word.lower() == target.lower():
                continue

            # Skip morphological variants of anchor/target
            if _is_morphological_variant(word, anchor) or _is_morphological_variant(word, target):
                continue

            # Skip morphological variants of already selected words
            is_variant = any(_is_morphological_variant(word, used) for used in used_words)
            if is_variant:
                continue

            union_words.append(word)
            used_words.append(word.lower())

            if len(union_words) >= num_concepts:
                break

        return union_words

    except Exception as e:
        print(f"get_statistical_union failed: {e}, falling back to neighbor sampling")
        # Fallback to neighbor-based sampling if database function doesn't exist
        return await _find_lexical_union_fallback(anchor, target, num_concepts, supabase, anchor_emb, target_emb)


async def _find_lexical_union_fallback(
    anchor: str,
    target: str,
    num_concepts: int,
    supabase,
    anchor_emb: list[float],
    target_emb: list[float]
) -> list[str]:
    """
    Fallback: Sample neighbors of anchor and target, score by sum of similarities.
    Less accurate than full scan but works without database function.
    """
    anchor_vec = np.array(anchor_emb)
    target_vec = np.array(target_emb)

    # Get candidates near both anchor and target regions
    anchor_result = supabase.rpc(
        "get_noise_floor_by_embedding",
        {
            "seed_embedding": anchor_vec.tolist(),
            "seed_word": anchor,
            "k": 200
        }
    ).execute()

    target_result = supabase.rpc(
        "get_noise_floor_by_embedding",
        {
            "seed_embedding": target_vec.tolist(),
            "seed_word": target,
            "k": 200
        }
    ).execute()

    if not anchor_result.data and not target_result.data:
        return []

    # Combine and deduplicate candidates
    candidate_words_set = set()
    candidate_words = []
    for r in (anchor_result.data or []) + (target_result.data or []):
        word = r["word"]
        if word not in candidate_words_set:
            candidate_words_set.add(word)
            candidate_words.append(word)

    if not candidate_words:
        return []

    # Get embeddings for all candidates
    from .embeddings import get_embeddings_batch
    candidate_embeddings = await get_embeddings_batch(candidate_words)

    # Score by sum of similarities
    scored_candidates = []
    for word, emb in zip(candidate_words, candidate_embeddings):
        if _is_morphological_variant(word, anchor) or _is_morphological_variant(word, target):
            continue

        word_vec = np.array(emb)
        sim_anchor = cosine_similarity(word_vec.tolist(), anchor_vec.tolist())
        sim_target = cosine_similarity(word_vec.tolist(), target_vec.tolist())
        score = sim_anchor + sim_target

        scored_candidates.append((word, score))

    scored_candidates.sort(key=lambda x: x[1], reverse=True)

    # Select top N, filtering morphological variants
    used_words = [anchor.lower(), target.lower()]
    union_words = []

    for word, score in scored_candidates:
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
    # Basic suffix variants
    assert _is_morphological_variant("cat", "cats") == True
    assert _is_morphological_variant("run", "running") == True
    assert _is_morphological_variant("happy", "happiness") == True
    assert _is_morphological_variant("cat", "dog") == False
    assert _is_morphological_variant("cat", "catalyst") == False  # Too different in length

    # Y→I transformations (INS-001.2 bug fix)
    assert _is_morphological_variant("mystery", "mysteries") == True
    assert _is_morphological_variant("mystery", "mysterious") == True
    assert _is_morphological_variant("mystery", "mysteriously") == True  # Chained suffixes

    # Prefix variants (INS-001.2 bug fix)
    assert _is_morphological_variant("certainty", "uncertainty") == True
    assert _is_morphological_variant("certain", "uncertain") == True
    assert _is_morphological_variant("certainty", "uncertain") == True  # Prefix + suffix
    assert _is_morphological_variant("happy", "unhappy") == True
    assert _is_morphological_variant("possible", "impossible") == True
    assert _is_morphological_variant("agree", "disagree") == True

    # Non-variants should still return False
    assert _is_morphological_variant("mystery", "assurance") == False
    assert _is_morphological_variant("certainty", "doubtless") == False


def test_word_stem():
    """Test word stemming."""
    assert _get_word_stem("running") == "runn"
    assert _get_word_stem("cats") == "cat"
    assert _get_word_stem("happiness") == "happi"


def test_normalize_stem():
    """Test stem normalization for Y→I handling."""
    assert _normalize_stem("mystery") == "myster"
    assert _normalize_stem("mysteries") == "myster"
    assert _normalize_stem("mysterious") == "myster"
    assert _normalize_stem("mysteriously") == "myster"  # Chained suffixes


def test_strip_prefixes():
    """Test prefix stripping."""
    assert _strip_common_prefixes("uncertainty") == "certainty"
    assert _strip_common_prefixes("unhappy") == "happy"
    assert _strip_common_prefixes("impossible") == "possible"
    assert _strip_common_prefixes("disagree") == "agree"
    # Should not strip if result would be too short
    assert _strip_common_prefixes("unit") == "unit"


if __name__ == "__main__":
    test_morphological_variants()
    test_word_stem()
    test_normalize_stem()
    test_strip_prefixes()
    print("All tests passed!")
