"""
Scoring Algorithms - INS-001.2 Semantic Union

These algorithms measure how participants construct conceptual unions
between two semantic domains (anchor and target words).

Key difference from INS-001:
- Divergence measures perpendicular distance from anchor-target LINE
  (not distance from neighborhood centroid)
- Reconstruction measures how well recipient recovered the pair
  (not convergence to single seed)
- Lexical Union finds words equidistant to both anchor and target
  (not a sequential path)
"""

import numpy as np
from typing import Optional

from .scoring import cosine_similarity, FUZZY_EXACT_MATCH_THRESHOLD


# Calibration constant for divergence normalization
# Represents expected max perpendicular distance in embedding space
# Calibrate empirically based on text-embedding-3-small characteristics
CALIBRATION_MAX = 0.8


def calculate_divergence(
    anchor_embedding: list[float],
    target_embedding: list[float],
    clue_embeddings: list[list[float]]
) -> float:
    """
    Calculate divergence score: how far clues arc from the direct anchor-target path.

    Measures mean perpendicular distance of clue vectors from the line
    connecting anchor to target in embedding space.

    Args:
        anchor_embedding: Embedding vector for anchor word
        target_embedding: Embedding vector for target word
        clue_embeddings: List of embedding vectors for clues (1-5)

    Returns:
        Divergence score (0-100 scale)
        - 0-30: Predictable (clues lie close to direct path)
        - 30-70: Moderate arc
        - 70-100: Creative (clues take circuitous route)
    """
    if not clue_embeddings:
        return 0.0

    anchor_vec = np.array(anchor_embedding)
    target_vec = np.array(target_embedding)

    # Define the line direction (anchor → target)
    line_direction = target_vec - anchor_vec
    line_length_sq = np.dot(line_direction, line_direction)

    # Handle edge case: anchor and target are identical
    if line_length_sq < 1e-10:
        return 0.0

    perpendicular_distances = []

    for clue_emb in clue_embeddings:
        clue_vec = np.array(clue_emb)

        # Vector from anchor to clue
        anchor_to_clue = clue_vec - anchor_vec

        # Project clue onto the line
        # projection_scalar t: where on the line [0=anchor, 1=target]
        projection_scalar = np.dot(anchor_to_clue, line_direction) / line_length_sq

        # Point on line closest to clue
        projection_point = anchor_vec + projection_scalar * line_direction

        # Perpendicular distance (Euclidean)
        perp_distance = np.linalg.norm(clue_vec - projection_point)
        perpendicular_distances.append(perp_distance)

    # Mean perpendicular distance
    mean_perp_distance = np.mean(perpendicular_distances)

    # Normalize to 0-100 scale
    normalized_score = min(100.0, (mean_perp_distance / CALIBRATION_MAX) * 100)

    return float(normalized_score)


def calculate_bridge_similarity(
    sender_clue_embeddings: list[list[float]],
    recipient_clue_embeddings: list[list[float]],
    anchor_embedding: list[float] | None = None,
    target_embedding: list[float] | None = None
) -> dict:
    """
    Calculate how similarly two bridges traverse the anchor-target space.

    Compares two sets of clues (sender's bridge vs recipient's bridge) to measure
    whether they took similar conceptual paths between the same endpoints.

    Metrics:
    1. Centroid similarity: Cosine similarity of clue centroids (primary metric)
    2. Path alignment: Whether bridges arc on the same "side" of the A-T line
       (if anchor/target embeddings provided)

    Args:
        sender_clue_embeddings: Embeddings for sender's clues
        recipient_clue_embeddings: Embeddings for recipient's clues
        anchor_embedding: Optional anchor embedding (for path alignment)
        target_embedding: Optional target embedding (for path alignment)

    Returns:
        Dictionary with:
        - overall: Combined bridge similarity score (0-100)
        - centroid_similarity: How close the clue centroids are (0-100)
        - path_alignment: Whether bridges curve same direction (-1 to 1, None if no anchor/target)
    """
    if not sender_clue_embeddings or not recipient_clue_embeddings:
        return {
            "overall": 0.0,
            "centroid_similarity": 0.0,
            "path_alignment": None
        }

    # Compute centroids
    sender_vecs = [np.array(e) for e in sender_clue_embeddings]
    recipient_vecs = [np.array(e) for e in recipient_clue_embeddings]

    sender_centroid = np.mean(sender_vecs, axis=0)
    recipient_centroid = np.mean(recipient_vecs, axis=0)

    # Centroid similarity (cosine)
    centroid_sim = cosine_similarity(sender_centroid.tolist(), recipient_centroid.tolist())
    centroid_sim_pct = max(0.0, centroid_sim) * 100

    # Path alignment (if anchor/target provided)
    path_alignment = None
    if anchor_embedding is not None and target_embedding is not None:
        anchor_vec = np.array(anchor_embedding)
        target_vec = np.array(target_embedding)

        # Line direction
        line_dir = target_vec - anchor_vec
        line_len_sq = np.dot(line_dir, line_dir)

        if line_len_sq > 1e-10:
            # Get perpendicular components for each centroid
            def get_perpendicular(centroid):
                proj_scalar = np.dot(centroid - anchor_vec, line_dir) / line_len_sq
                proj_point = anchor_vec + proj_scalar * line_dir
                return centroid - proj_point

            sender_perp = get_perpendicular(sender_centroid)
            recipient_perp = get_perpendicular(recipient_centroid)

            # Path alignment: cosine of perpendicular vectors
            # +1 = same side, -1 = opposite sides, 0 = one on line
            sender_perp_norm = np.linalg.norm(sender_perp)
            recipient_perp_norm = np.linalg.norm(recipient_perp)

            if sender_perp_norm > 1e-10 and recipient_perp_norm > 1e-10:
                path_alignment = float(
                    np.dot(sender_perp, recipient_perp) /
                    (sender_perp_norm * recipient_perp_norm)
                )

    # Overall score: primarily centroid similarity
    # Could incorporate path_alignment as a modifier, but keep it simple for now
    overall = centroid_sim_pct

    return {
        "overall": float(overall),
        "centroid_similarity": float(centroid_sim_pct),
        "path_alignment": path_alignment
    }


def calculate_semantic_distance(
    embedding1: list[float],
    embedding2: list[float]
) -> float:
    """
    Calculate semantic distance between two embeddings.

    Returns a 0-100 scale where:
    - 0 = identical (cosine similarity = 1)
    - 100 = maximally distant (cosine similarity = -1)

    Useful for showing how "far apart" anchor and target are.
    """
    sim = cosine_similarity(embedding1, embedding2)
    # Convert similarity (-1 to 1) to distance (0 to 100)
    # sim=1 -> distance=0, sim=0 -> distance=50, sim=-1 -> distance=100
    distance = (1 - sim) * 50
    return float(max(0.0, min(100.0, distance)))


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
    Calculate reconstruction accuracy: how well recipient recovered anchor-target pair.

    Handles order ambiguity: recipient might swap anchor and target.
    Uses cosine similarity for semantic distance measurement.

    Args:
        true_anchor_embedding: Embedding for true anchor word
        true_target_embedding: Embedding for true target word
        guessed_anchor_embedding: Embedding for guessed anchor
        guessed_target_embedding: Embedding for guessed target
        true_anchor: True anchor word (for exact match check)
        true_target: True target word (for exact match check)
        guessed_anchor: Guessed anchor word
        guessed_target: Guessed target word

    Returns:
        Dictionary with:
        - overall: Overall reconstruction score (0-100)
        - anchor_similarity: Similarity of anchor guess (0-100)
        - target_similarity: Similarity of target guess (0-100)
        - order_swapped: Whether best match requires swapping
        - exact_anchor_match: Whether anchor was exactly matched
        - exact_target_match: Whether target was exactly matched
    """
    true_a = np.array(true_anchor_embedding)
    true_t = np.array(true_target_embedding)
    guess_a = np.array(guessed_anchor_embedding)
    guess_t = np.array(guessed_target_embedding)

    # Calculate similarities for both orderings
    # Ordering 1: guess_a → true_a, guess_t → true_t (normal)
    sim_a1 = cosine_similarity(guess_a.tolist(), true_a.tolist())
    sim_t1 = cosine_similarity(guess_t.tolist(), true_t.tolist())
    score_ordering1 = (sim_a1 + sim_t1) / 2

    # Ordering 2: guess_a → true_t, guess_t → true_a (swapped)
    sim_a2 = cosine_similarity(guess_a.tolist(), true_t.tolist())
    sim_t2 = cosine_similarity(guess_t.tolist(), true_a.tolist())
    score_ordering2 = (sim_a2 + sim_t2) / 2

    # Take better ordering
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

    # Convert cosine similarity (typically 0-1) to percentage
    # Note: cosine sim can be negative; clamp to 0
    overall_pct = max(0.0, best_score) * 100
    anchor_pct = max(0.0, anchor_sim) * 100
    target_pct = max(0.0, target_sim) * 100

    # Check for exact matches (string or fuzzy embedding)
    true_anchor_lower = true_anchor.lower().strip()
    true_target_lower = true_target.lower().strip()
    guessed_anchor_lower = guessed_anchor.lower().strip()
    guessed_target_lower = guessed_target.lower().strip()

    if order_swapped:
        # If swapped, compare guess_anchor to true_target and vice versa
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
    Calculate statistical baseline: what anchor-target pair embedding geometry predicts.

    Approach:
    1. Find vocabulary words close to clue centroid
    2. For each pair of candidates, score how well clues explain the pair
    3. Return best-fit pair and its reconstruction score

    Args:
        clue_embeddings: Embeddings for the clues
        true_anchor: True anchor word (for scoring)
        true_target: True target word (for scoring)
        true_anchor_embedding: Embedding for true anchor
        true_target_embedding: Embedding for true target
        vocabulary: List of (word, embedding) tuples
        top_k: Number of candidate words to consider

    Returns:
        Dictionary with:
        - guessed_anchor: Best-fit anchor word
        - guessed_target: Best-fit target word
        - reconstruction_score: How well this guess matches truth (0-100)
        - method: Algorithm used
    """
    if not clue_embeddings or not vocabulary:
        return {
            "guessed_anchor": None,
            "guessed_target": None,
            "reconstruction_score": 0.0,
            "method": "failed"
        }

    # Compute clue centroid
    clue_vecs = [np.array(c) for c in clue_embeddings]
    clue_centroid = np.mean(clue_vecs, axis=0)

    # Find candidate words close to clue centroid
    candidates = []
    for word, embedding in vocabulary:
        word_vec = np.array(embedding)
        dist_to_centroid = np.linalg.norm(word_vec - clue_centroid)
        candidates.append((word, dist_to_centroid, word_vec))

    # Sort by distance and take top_k
    candidates.sort(key=lambda x: x[1])
    top_candidates = candidates[:top_k]

    # Score pairs: which pair of candidates best explains the clues?
    best_pair = None
    best_pair_score = -1.0

    for i, (word_a, _, vec_a) in enumerate(top_candidates):
        for j, (word_t, _, vec_t) in enumerate(top_candidates):
            if i >= j:
                continue

            # Score: how well do clues lie along this pair's axis?
            line_dir = vec_t - vec_a
            line_len_sq = np.dot(line_dir, line_dir)

            if line_len_sq < 1e-10:
                continue

            # Mean projection of clues onto line (should be ~0.5 for good bridge)
            # Plus: clues should have low perpendicular distance
            total_proj = 0.0
            total_perp = 0.0

            for clue_vec in clue_vecs:
                proj_scalar = np.dot(clue_vec - vec_a, line_dir) / line_len_sq
                proj_point = vec_a + proj_scalar * line_dir
                perp_dist = np.linalg.norm(clue_vec - proj_point)
                total_proj += proj_scalar
                total_perp += perp_dist

            mean_proj = total_proj / len(clue_vecs)
            mean_perp = total_perp / len(clue_vecs)

            # Good pair: mean projection near 0.5, low perpendicular distance
            proj_score = 1.0 - abs(mean_proj - 0.5) * 2  # 1 if centered, 0 if at ends
            perp_score = 1.0 / (1.0 + mean_perp)  # Higher is better

            pair_score = proj_score * perp_score

            if pair_score > best_pair_score:
                best_pair_score = pair_score
                best_pair = (word_a, word_t, vec_a, vec_t)

    if best_pair:
        word_a, word_t, vec_a, vec_t = best_pair

        # Calculate reconstruction score for the statistical guess
        recon = calculate_reconstruction(
            true_anchor_embedding=true_anchor_embedding,
            true_target_embedding=true_target_embedding,
            guessed_anchor_embedding=vec_a.tolist(),
            guessed_target_embedding=vec_t.tolist(),
            true_anchor=true_anchor,
            true_target=true_target,
            guessed_anchor=word_a,
            guessed_target=word_t
        )

        return {
            "guessed_anchor": word_a,
            "guessed_target": word_t,
            "reconstruction_score": recon["overall"],
            "method": "centroid_line_fit"
        }

    return {
        "guessed_anchor": None,
        "guessed_target": None,
        "reconstruction_score": 0.0,
        "method": "failed"
    }


def get_divergence_interpretation(score: float) -> str:
    """
    Get human-readable interpretation of divergence score.

    Args:
        score: Divergence score (0-100)

    Returns:
        Interpretation label
    """
    if score < 30:
        return "Predictable"
    elif score < 50:
        return "Moderate"
    elif score < 70:
        return "Creative"
    else:
        return "Highly Creative"


def get_reconstruction_interpretation(score: float) -> str:
    """
    Get human-readable interpretation of reconstruction score.

    Args:
        score: Reconstruction score (0-100)

    Returns:
        Interpretation label
    """
    if score < 40:
        return "Opaque"
    elif score < 60:
        return "Partial"
    elif score < 80:
        return "Good"
    else:
        return "Transparent"


# ============================================
# JOINT DISTANCE SCORING (Semantic Union)
# ============================================

# Calibration constant for joint distance normalization
# Represents expected max distance difference in embedding space
JOINT_DISTANCE_MAX_DIFF = 1.5


def calculate_joint_distance_score(
    word_embedding: list[float],
    anchor_embedding: list[float],
    target_embedding: list[float]
) -> float:
    """
    Calculate how equidistant a word is to both anchor and target.

    Score is higher when word is equally distant from both concepts.
    Used to evaluate how well participant words form a semantic union.

    Args:
        word_embedding: Embedding vector for the word to score
        anchor_embedding: Embedding vector for anchor concept
        target_embedding: Embedding vector for target concept

    Returns:
        Score 0-100 where 100 = perfectly equidistant
    """
    word_vec = np.array(word_embedding)
    anchor_vec = np.array(anchor_embedding)
    target_vec = np.array(target_embedding)

    dist_to_anchor = np.linalg.norm(word_vec - anchor_vec)
    dist_to_target = np.linalg.norm(word_vec - target_vec)

    # Calculate how close the distances are (smaller difference = more equidistant)
    distance_diff = abs(dist_to_anchor - dist_to_target)

    # Normalize: 0 difference = 100 score, large difference = low score
    equidistance_score = max(0, 100 * (1 - distance_diff / JOINT_DISTANCE_MAX_DIFF))

    return float(equidistance_score)


def calculate_union_quality(
    clue_embeddings: list[list[float]],
    anchor_embedding: list[float],
    target_embedding: list[float]
) -> dict:
    """
    Calculate overall quality of participant's semantic union.

    Measures how well the participant's concepts form an equidistant set
    between anchor and target.

    Args:
        clue_embeddings: List of embedding vectors for participant's concepts
        anchor_embedding: Embedding vector for anchor concept
        target_embedding: Embedding vector for target concept

    Returns:
        Dictionary with:
        - overall: Mean joint distance score (0-100)
        - individual_scores: List of scores for each concept
        - interpretation: Human-readable interpretation
    """
    if not clue_embeddings:
        return {
            "overall": 0.0,
            "individual_scores": [],
            "interpretation": "No concepts provided"
        }

    individual_scores = [
        calculate_joint_distance_score(emb, anchor_embedding, target_embedding)
        for emb in clue_embeddings
    ]

    overall = float(np.mean(individual_scores))

    if overall >= 70:
        interpretation = "Excellent union - concepts are well-balanced between both ideas"
    elif overall >= 50:
        interpretation = "Good union - concepts connect both ideas reasonably well"
    elif overall >= 30:
        interpretation = "Moderate union - concepts lean toward one idea"
    else:
        interpretation = "Weak union - concepts cluster around one idea"

    return {
        "overall": overall,
        "individual_scores": individual_scores,
        "interpretation": interpretation
    }


def get_union_quality_interpretation(score: float) -> str:
    """
    Get human-readable interpretation of union quality score.

    Args:
        score: Union quality score (0-100)

    Returns:
        Interpretation label
    """
    if score >= 70:
        return "Excellent"
    elif score >= 50:
        return "Good"
    elif score >= 30:
        return "Moderate"
    else:
        return "Weak"


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


async def find_lexical_union(
    anchor: str,
    target: str,
    num_concepts: int,
    supabase
) -> list[str]:
    """
    Find the N vocabulary words most equidistant to both anchor and target.

    Instead of finding a path from A to T, finds words that sit at similar
    distances from both concepts - words in the "union" of both semantic spaces.

    Scoring: For each candidate word, calculate:
    - dist_to_anchor = ||word_vec - anchor_vec||
    - dist_to_target = ||word_vec - target_vec||
    - equidistance_score = 1 / (1 + |dist_to_anchor - dist_to_target|)

    Return the N words with highest equidistance scores.

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

    # Get candidate words near the midpoint region
    midpoint = (anchor_vec + target_vec) / 2

    # Get candidates near the midpoint region (single fast query)
    result = supabase.rpc(
        "get_noise_floor_by_embedding",
        {
            "seed_embedding": midpoint.tolist(),
            "seed_word": "",  # No word to exclude by name
            "k": 200  # More candidates for better selection
        }
    ).execute()

    if not result.data:
        return []

    # Build candidate list with their embeddings
    candidate_words = [r["word"] for r in result.data]

    # Get embeddings for all candidates in one batch
    candidate_embeddings = await get_embeddings_batch(candidate_words)

    # Track used words for morphological variant detection
    used_words = [anchor.lower(), target.lower()]

    # Score each candidate by equidistance
    scored_candidates = []
    for word, emb in zip(candidate_words, candidate_embeddings):
        if _is_morphological_variant(word, anchor) or _is_morphological_variant(word, target):
            continue

        word_vec = np.array(emb)
        dist_to_anchor = np.linalg.norm(word_vec - anchor_vec)
        dist_to_target = np.linalg.norm(word_vec - target_vec)

        # Equidistance: prefer words with similar distances to both concepts
        # Lower |dist_to_anchor - dist_to_target| = more equidistant
        equidistance_score = 1.0 / (1.0 + abs(dist_to_anchor - dist_to_target))

        # Also factor in being reasonably close to midpoint (not too far from both)
        avg_distance = (dist_to_anchor + dist_to_target) / 2
        proximity_score = 1.0 / (1.0 + avg_distance)

        # Combined score: equidistance matters most, but proximity is a tiebreaker
        combined_score = equidistance_score * 0.8 + proximity_score * 0.2

        scored_candidates.append((word, combined_score))

    # Sort by score (descending) and select top N, avoiding morphological variants
    scored_candidates.sort(key=lambda x: x[1], reverse=True)

    union_words = []
    for word, score in scored_candidates:
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
# TEST CASES - Run with pytest
# ============================================

def test_divergence_on_line():
    """Clues on the line should have low divergence."""
    # anchor at origin, target at [1,0,0]
    anchor = [0.0, 0.0, 0.0]
    target = [1.0, 0.0, 0.0]

    # Clue at midpoint (on line)
    clues = [[0.5, 0.0, 0.0]]

    div = calculate_divergence(anchor, target, clues)
    assert div < 10, f"Clue on line should have low divergence, got {div}"


def test_divergence_perpendicular():
    """Clues perpendicular to line should have high divergence."""
    anchor = [0.0, 0.0, 0.0]
    target = [1.0, 0.0, 0.0]

    # Clue perpendicular to line
    clues = [[0.5, 0.8, 0.0]]  # 0.8 distance perpendicular

    div = calculate_divergence(anchor, target, clues)
    assert div > 50, f"Perpendicular clue should have high divergence, got {div}"


def test_reconstruction_exact_match():
    """Exact matches should give 100% reconstruction."""
    # Same embeddings
    anchor_emb = [1.0, 0.0, 0.0]
    target_emb = [0.0, 1.0, 0.0]

    result = calculate_reconstruction(
        anchor_emb, target_emb,
        anchor_emb, target_emb,
        "cat", "dog",
        "cat", "dog"
    )

    assert result["overall"] == 100.0
    assert result["exact_anchor_match"] == True
    assert result["exact_target_match"] == True
    assert result["order_swapped"] == False


def test_reconstruction_swapped_order():
    """Should detect when guesses are swapped."""
    anchor_emb = [1.0, 0.0, 0.0]
    target_emb = [0.0, 1.0, 0.0]

    # Guess with swapped order
    result = calculate_reconstruction(
        anchor_emb, target_emb,
        target_emb, anchor_emb,  # Swapped!
        "cat", "dog",
        "dog", "cat"  # Swapped!
    )

    assert result["overall"] == 100.0
    assert result["order_swapped"] == True


def test_reconstruction_partial():
    """Partial matches should give intermediate scores."""
    anchor_emb = [1.0, 0.0, 0.0]
    target_emb = [0.0, 1.0, 0.0]

    # Guess is similar but not exact
    guessed_anchor = [0.9, 0.1, 0.0]  # Close to anchor
    guessed_target = [0.1, 0.9, 0.0]  # Close to target

    result = calculate_reconstruction(
        anchor_emb, target_emb,
        guessed_anchor, guessed_target,
        "cat", "dog",
        "kitten", "puppy"
    )

    assert 70 < result["overall"] < 100
    assert result["exact_anchor_match"] == False
    assert result["exact_target_match"] == False


if __name__ == "__main__":
    test_divergence_on_line()
    test_divergence_perpendicular()
    test_reconstruction_exact_match()
    test_reconstruction_swapped_order()
    test_reconstruction_partial()
    print("All bridging scoring tests passed!")
