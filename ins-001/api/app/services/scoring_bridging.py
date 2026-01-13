"""
Scoring Algorithms - INS-001.2 Semantic Bridging

These algorithms measure how participants construct conceptual bridges
between two semantic domains (anchor and target words).

Key difference from INS-001:
- Divergence measures perpendicular distance from anchor-target LINE
  (not distance from neighborhood centroid)
- Reconstruction measures how well recipient recovered the pair
  (not convergence to single seed)
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
