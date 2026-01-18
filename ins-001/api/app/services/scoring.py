"""
Scoring Algorithms - INS-001 Semantic Associations

This module implements the unified scoring framework for both:
- INS-001.1 (Semantic Radiation): Single seed word, clues radiate outward
- INS-001.2 (Semantic Union): Anchor-target pair, clues bridge between them

Both instruments use exactly TWO metrics:
1. **Relevance** — Are the clues semantically connected to the prompt?
2. **Divergence** — How spread out are the clues from each other? (DAT-style)

These metrics are orthogonal:
- High relevance + high divergence = creative but valid
- High relevance + low divergence = predictable/conventional
- Low relevance = noise (divergence becomes meaningless)

Literature basis:
- Relevance: Standard in information retrieval (query-document relevance)
- Divergence: Divergent Association Task (Olson et al., 2021, PNAS)
"""

import numpy as np
from typing import Optional


# ============================================
# CORE UTILITIES
# ============================================

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """
    Compute cosine similarity between two vectors.

    Returns value in range [-1, 1], where:
    - 1 = identical direction
    - 0 = orthogonal
    - -1 = opposite direction

    For normalized embeddings (which OpenAI provides), this equals dot product.
    """
    a = np.array(a)
    b = np.array(b)

    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(dot / (norm_a * norm_b))


# ============================================
# RELEVANCE THRESHOLD
# ============================================

# Minimum relevance score for a submission to be considered valid
# Submissions below this threshold are likely noise
RELEVANCE_THRESHOLD = 0.15


# ============================================
# DIVERGENCE (Unified for both instruments)
# ============================================

def calculate_divergence(
    clue_embeddings: list[list[float]],
    prompt_embeddings: list[list[float]]
) -> float:
    """
    Mean pairwise cosine distance between all words (clues + prompt).

    NOTE: For INS-001.2 (bridging), use calculate_spread_clues_only() instead.
    Including anchor/target in the calculation conflates pair difficulty with
    participant performance. See MTH-002.1 v2.0 Section 3.1.

    This function is retained for:
    - Legacy compatibility
    - Contexts where prompt-inclusive divergence is explicitly needed

    Args:
        clue_embeddings: Embeddings for submitted clues
        prompt_embeddings: Embeddings for prompt words
            - INS-001.1: [seed_embedding]
            - INS-001.2: [anchor_embedding, target_embedding]

    Returns:
        Score 0-100 (DAT convention)
        - < 50: Poor (often misunderstanding instructions)
        - 65-90: Common range
        - 75-80: Average
        - 95+: Very high
        - 100+: Almost never exceeded

    Literature: Olson et al. (2021), PNAS - "Naming unrelated words predicts creativity"
    """
    all_embeddings = prompt_embeddings + clue_embeddings

    if len(all_embeddings) < 2:
        return 0.0

    distances = []
    n = len(all_embeddings)

    for i in range(n):
        for j in range(i + 1, n):
            sim = cosine_similarity(all_embeddings[i], all_embeddings[j])
            distance = 1 - sim  # cosine distance
            distances.append(distance)

    return float(np.mean(distances) * 100)


# ============================================
# INS-001.1: SEMANTIC RADIATION
# ============================================

def calculate_spread_clues_only(clue_embeddings: list[list[float]]) -> float:
    """
    Calculate spread as mean pairwise distance among clues only (excludes seed).

    This is specific to INS-001.1 and measures how diverse the associations
    are from EACH OTHER, not from the seed word. This better captures
    "breadth of associative thinking" for a task that asks for associations
    to a target word.

    For INS-001.2 (bridging), use calculate_divergence() which includes
    anchor and target words in the calculation.

    Args:
        clue_embeddings: Embeddings for submitted clues (1-5 words)

    Returns:
        Score 0-100 (scaled for consistency with DAT scores)
        Higher = more diverse associations from each other
    """
    if len(clue_embeddings) < 2:
        # Can't compute pairwise distance with fewer than 2 clues
        # Return 0 as a neutral score (will need calibration data to interpret)
        return 0.0

    distances = []
    n = len(clue_embeddings)

    for i in range(n):
        for j in range(i + 1, n):
            sim = cosine_similarity(clue_embeddings[i], clue_embeddings[j])
            distance = 1 - sim  # cosine distance
            distances.append(distance)

    return float(np.mean(distances) * 100)


def score_radiation(
    clue_embeddings: list[list[float]],
    seed_embedding: list[float]
) -> dict:
    """
    Score a participant's semantic radiation submission (INS-001.1).

    Relevance: How connected are clues to the seed topic?
    Spread: How diverse are the clues from each other? (clues-only, no seed)

    Note: INS-001.1 uses "spread" (clues-only) rather than "divergence" (DAT-style
    with seed included). This better measures associative breadth when the task
    asks for related associations rather than unrelated words.

    Args:
        clue_embeddings: List of embedding vectors for submitted clues
        seed_embedding: Embedding vector for seed concept

    Returns:
        Dictionary with:
        - relevance: Overall relevance score (mean similarity to seed)
        - relevance_individual: Per-clue relevance scores
        - spread: Spread among clues only (0-100, excludes seed)
        - divergence: Legacy DAT-style divergence (0-100, includes seed) - for comparison
        - valid: Whether submission passes relevance threshold
    """
    if not clue_embeddings:
        return {
            "relevance": 0.0,
            "relevance_individual": [],
            "spread": 0.0,
            "divergence": 0.0,
            "valid": False
        }

    # Relevance: similarity to seed
    relevance_scores = [
        cosine_similarity(clue, seed_embedding)
        for clue in clue_embeddings
    ]

    overall_relevance = float(np.mean(relevance_scores))

    # Spread: clues-only (INS-001.1 primary metric)
    overall_spread = calculate_spread_clues_only(clue_embeddings)

    # Divergence: DAT-style with seed (kept for comparison/backwards compatibility)
    overall_divergence = calculate_divergence(clue_embeddings, [seed_embedding])

    valid = overall_relevance >= RELEVANCE_THRESHOLD

    return {
        "relevance": overall_relevance,
        "relevance_individual": relevance_scores,
        "spread": overall_spread,
        "divergence": overall_divergence,
        "valid": valid
    }


# ============================================
# INS-001.2: SEMANTIC UNION
# ============================================

def score_union(
    clue_embeddings: list[list[float]],
    anchor_embedding: list[float],
    target_embedding: list[float]
) -> dict:
    """
    Score a participant's semantic union submission (INS-001.2).

    Relevance: How connected are clues to BOTH anchor and target?
    Uses min(sim_anchor, sim_target) to ensure clues bridge both endpoints,
    not just cluster near one. This matches the lexical union baseline scoring.

    Spread: Mean pairwise distance among clues only (excludes anchor/target).
    This isolates participant performance from pair difficulty and aligns with
    the DAT methodology which only uses participant-generated words.

    See MTH-002.1 v2.0 Section 3.1 for methodology details.

    Args:
        clue_embeddings: List of embedding vectors for submitted clues
        anchor_embedding: Embedding vector for anchor concept
        target_embedding: Embedding vector for target concept

    Returns:
        Dictionary with:
        - relevance: Overall relevance score (mean of min(sim_a, sim_t) per clue)
        - relevance_individual: Per-clue relevance scores
        - spread: Clue-only spread (0-100, excludes anchor/target)
        - divergence: Alias for spread (for backwards compatibility)
        - valid: Whether submission passes relevance threshold
    """
    if not clue_embeddings:
        return {
            "relevance": 0.0,
            "relevance_individual": [],
            "spread": 0.0,
            "divergence": 0.0,
            "valid": False
        }

    # Relevance: min similarity to both endpoints (must connect to BOTH)
    # Using min() ensures clues bridge between anchor and target,
    # rather than clustering near just one endpoint
    relevance_scores = []
    for clue in clue_embeddings:
        sim_a = cosine_similarity(clue, anchor_embedding)
        sim_t = cosine_similarity(clue, target_embedding)
        relevance_scores.append(min(sim_a, sim_t))

    overall_relevance = float(np.mean(relevance_scores))

    # Spread: clue-only pairwise distance (MTH-002.1 v2.0)
    # This isolates participant contribution from pair difficulty
    overall_spread = calculate_spread_clues_only(clue_embeddings)

    valid = overall_relevance >= RELEVANCE_THRESHOLD

    return {
        "relevance": overall_relevance,
        "relevance_individual": relevance_scores,
        "spread": overall_spread,
        "divergence": overall_spread,  # Alias for backwards compatibility
        "valid": valid
    }


# ============================================
# SCORE NORMALIZATION
# ============================================

def bootstrap_null_distribution(
    prompt_embeddings: dict,
    vocabulary_embeddings: list[list[float]],
    n_clues: int,
    instrument: str,
    n_samples: int = 500,
    seed: int = 42
) -> dict:
    """
    Build null distributions for relevance and divergence by sampling
    random word sets from vocabulary.

    This function can be called EARLY (after prompt selection) so that
    null distributions are ready before the participant submits their clues.

    Args:
        prompt_embeddings: For INS-001.1: {"seed": embedding}
                          For INS-001.2: {"anchor": embedding, "target": embedding}
        vocabulary_embeddings: List of embeddings for vocabulary words
        n_clues: Number of clues to sample (match participant's submission size)
        instrument: "radiation" (INS-001.1) or "union" (INS-001.2)
        n_samples: Number of bootstrap samples (default 500)
        seed: Random seed for reproducibility

    Returns:
        Dictionary with:
        - relevance_mean: Mean relevance under null
        - relevance_std: Std of relevance under null
        - divergence_mean: Mean divergence under null
        - divergence_std: Std of divergence under null
        - relevance_samples: Raw samples (for percentile calculation)
        - divergence_samples: Raw samples
        - n_clues: Number of clues used (for validation)
    """
    if not vocabulary_embeddings or n_clues <= 0:
        return {
            "relevance_mean": 0.0,
            "relevance_std": 0.0,
            "divergence_mean": 70.0,  # Default to DAT average
            "divergence_std": 0.0,
            "relevance_samples": [],
            "divergence_samples": [],
            "n_clues": n_clues
        }

    rng = np.random.default_rng(seed)

    relevance_samples = []
    divergence_samples = []

    vocab_array = np.array(vocabulary_embeddings)
    n_vocab = len(vocab_array)

    for _ in range(n_samples):
        # Sample n random words (without replacement)
        indices = rng.choice(n_vocab, size=min(n_clues, n_vocab), replace=False)
        sample_embeddings = [vocab_array[i].tolist() for i in indices]

        # Score this random set
        if instrument == "radiation":
            scores = score_radiation(sample_embeddings, prompt_embeddings["seed"])
        elif instrument == "union":
            scores = score_union(
                sample_embeddings,
                prompt_embeddings["anchor"],
                prompt_embeddings["target"]
            )
        else:
            raise ValueError(f"Unknown instrument: {instrument}")

        relevance_samples.append(scores["relevance"])
        divergence_samples.append(scores["divergence"])

    return {
        "relevance_mean": float(np.mean(relevance_samples)),
        "relevance_std": float(np.std(relevance_samples)),
        "divergence_mean": float(np.mean(divergence_samples)),
        "divergence_std": float(np.std(divergence_samples)),
        "relevance_samples": relevance_samples,
        "divergence_samples": divergence_samples,
        "n_clues": n_clues
    }


def normalize_scores(
    participant_scores: dict,
    null_distribution: dict,
    method: str = "percentile"
) -> dict:
    """
    Normalize participant scores against null distribution.

    Args:
        participant_scores: Output from score_radiation() or score_union()
        null_distribution: Output from bootstrap_null_distribution()
        method: "percentile" (0-100) or "zscore" (standard deviations from mean)

    Returns:
        Dictionary with:
        - relevance_normalized: Normalized relevance score
        - divergence_normalized: Normalized divergence score
        - relevance_raw: Original relevance
        - divergence_raw: Original divergence

    Interpretation (percentile method, recommended for user-facing display):
        < 25th: Below average (worse than random)
        25th-50th: Low average
        50th-75th: Above average
        75th-90th: Good (better than most random sets)
        90th-99th: Excellent
        > 99th: Exceptional

    Interpretation (z-score method, recommended for statistical analysis):
        < 0: Below null mean
        0-1: Slightly above average
        1-2: Notably above average
        > 2: Significantly above average (p < 0.05)
        > 3: Highly significant (p < 0.001)
    """
    rel_raw = participant_scores.get("relevance", 0.0)
    div_raw = participant_scores.get("divergence", 0.0)

    if method == "percentile":
        rel_samples = null_distribution.get("relevance_samples", [])
        div_samples = null_distribution.get("divergence_samples", [])

        if rel_samples:
            rel_norm = float(np.mean([rel_raw > s for s in rel_samples]) * 100)
        else:
            rel_norm = 50.0

        if div_samples:
            div_norm = float(np.mean([div_raw > s for s in div_samples]) * 100)
        else:
            div_norm = 50.0

    elif method == "zscore":
        rel_std = null_distribution.get("relevance_std", 0.0)
        div_std = null_distribution.get("divergence_std", 0.0)
        rel_mean = null_distribution.get("relevance_mean", 0.0)
        div_mean = null_distribution.get("divergence_mean", 0.0)

        if rel_std > 0:
            rel_norm = float((rel_raw - rel_mean) / rel_std)
        else:
            rel_norm = 0.0

        if div_std > 0:
            div_norm = float((div_raw - div_mean) / div_std)
        else:
            div_norm = 0.0

    else:
        raise ValueError(f"Unknown method: {method}")

    return {
        "relevance_normalized": rel_norm,
        "divergence_normalized": div_norm,
        "relevance_raw": rel_raw,
        "divergence_raw": div_raw
    }


# ============================================
# COMPARISON
# ============================================

def compare_submissions(
    participant_scores: dict,
    baseline_scores: dict
) -> dict:
    """
    Compare participant submission against a baseline (e.g., LLM).
    Works for both INS-001.1 and INS-001.2.

    Args:
        participant_scores: Output from score_radiation() or score_union()
        baseline_scores: Output from score_radiation() or score_union()

    Returns:
        Dictionary with:
        - relevance_delta: Participant relevance - baseline relevance
        - divergence_delta: Participant divergence - baseline divergence
        - more_creative: Whether participant is more divergent (given valid relevance)
    """
    rel_delta = participant_scores.get("relevance", 0.0) - baseline_scores.get("relevance", 0.0)
    div_delta = participant_scores.get("divergence", 0.0) - baseline_scores.get("divergence", 0.0)

    both_valid = participant_scores.get("valid", False) and baseline_scores.get("valid", False)
    more_creative = both_valid and div_delta > 0

    return {
        "relevance_delta": rel_delta,
        "divergence_delta": div_delta,
        "more_creative": more_creative
    }


# ============================================
# INTERPRETATION HELPERS
# ============================================

def get_relevance_interpretation(score: float) -> str:
    """
    Get human-readable interpretation of relevance score.

    Args:
        score: Relevance score (typically 0-1)

    Returns:
        Interpretation label
    """
    if score < 0.15:
        return "Noise"
    elif score < 0.30:
        return "Weak"
    elif score < 0.45:
        return "Moderate"
    else:
        return "Strong"


def get_divergence_interpretation(score: float) -> str:
    """
    Get human-readable interpretation of divergence score (DAT-style 0-100).

    Based on Olson et al. (2021) PNAS:
    - < 50: Poor (often misunderstanding)
    - 65-90: Common range
    - 75-80: Average
    - 95+: Very high
    - 100+: Almost never exceeded

    Args:
        score: Divergence score (0-100)

    Returns:
        Interpretation label
    """
    if score < 50:
        return "Low"
    elif score < 75:
        return "Below Average"
    elif score < 85:
        return "Average"
    elif score < 95:
        return "Above Average"
    else:
        return "High"


def get_spread_interpretation_ins001_1(score: float) -> str:
    """
    Get human-readable interpretation of spread score for INS-001.1 (Signal).

    Uses clues-only spread (excludes seed word from pairwise distance calculation).
    This measures how diverse the associations are from EACH OTHER.

    Raw scores normalized to 20-80 practical range:
    - Even random input generates ~20 spread
    - Practical ceiling ~80

    Simple Low/Medium/High bands (scale still calibrating with human data):
    - Normalized < 33%: Low - Clustered associations
    - Normalized 33-66%: Medium - Moderate associative spread
    - Normalized > 66%: High - Diverse associations

    Raw score thresholds (derived from normalized range):
    - < 40: Low (normalized < 33%)
    - 40-60: Medium (normalized 33-66%)
    - > 60: High (normalized > 66%)

    Args:
        score: Spread score (0-100, clues-only)

    Returns:
        Interpretation label
    """
    # Normalize from 20-80 range to 0-100
    normalized = max(0, min(100, ((score - 20) / 60) * 100))

    # Bands: Low (0-33%), Medium (33-66%), High (66-100%)
    if normalized < 33:
        return "Low"
    elif normalized < 66:
        return "Medium"
    else:
        return "High"


# ============================================
# DEPRECATED FUNCTIONS (Backwards Compatibility)
# ============================================
# These functions are deprecated and will be removed in a future version.
# They are kept here for backwards compatibility with existing code.

import warnings

# Old threshold constant (kept for compatibility)
FUZZY_EXACT_MATCH_THRESHOLD = 0.99


def compute_divergence(
    clue_embeddings: list[list[float]],
    floor_embeddings: list[list[float]]
) -> float:
    """
    DEPRECATED: Use calculate_divergence() with DAT-style scoring instead.

    Old divergence algorithm based on noise floor centroid.
    """
    warnings.warn(
        "compute_divergence is deprecated. Use calculate_divergence with DAT-style scoring.",
        DeprecationWarning,
        stacklevel=2
    )

    if not clue_embeddings or not floor_embeddings:
        return 0.0

    floor_matrix = np.array(floor_embeddings)
    floor_centroid = np.mean(floor_matrix, axis=0)

    similarities = []
    for clue_emb in clue_embeddings:
        sim = cosine_similarity(clue_emb, floor_centroid.tolist())
        similarities.append(sim)

    mean_similarity = np.mean(similarities)
    divergence = 1.0 - mean_similarity

    return float(max(0.0, min(1.0, divergence)))


def compute_convergence(
    seed_embedding: list[float],
    guess_embeddings: list[list[float]],
    seed_word: str,
    guesses: list[str]
) -> tuple[float, bool, list[float]]:
    """
    DEPRECATED: Not used in current INS-001 scoring.

    Old convergence algorithm for single-word reconstruction.
    """
    warnings.warn(
        "compute_convergence is deprecated and not used in INS-001 scoring.",
        DeprecationWarning,
        stacklevel=2
    )

    seed_lower = seed_word.lower().strip()
    has_exact_match = False
    for guess in guesses:
        if guess.lower().strip() == seed_lower:
            has_exact_match = True
            break

    if not guess_embeddings:
        return 0.0, False, []

    similarities = []
    for guess_emb in guess_embeddings:
        sim = cosine_similarity(guess_emb, seed_embedding)
        similarities.append(sim)

    max_similarity = max(similarities) if similarities else 0.0
    has_fuzzy_exact = max_similarity > FUZZY_EXACT_MATCH_THRESHOLD
    exact_match = has_exact_match or has_fuzzy_exact

    mean_similarity = np.mean(similarities) if similarities else 0.0
    convergence_score = float(max(0.0, min(1.0, mean_similarity)))

    return convergence_score, exact_match, similarities


def compute_semantic_portability(
    network_convergence: Optional[float],
    stranger_convergence: Optional[float]
) -> Optional[float]:
    """
    DEPRECATED: Derived metric requiring network/stranger convergence.
    """
    warnings.warn(
        "compute_semantic_portability is deprecated.",
        DeprecationWarning,
        stacklevel=2
    )

    if network_convergence is None or stranger_convergence is None:
        return None
    if network_convergence == 0:
        return None

    return stranger_convergence / network_convergence


def compute_consistency(
    divergence_mean: Optional[float],
    divergence_std: Optional[float]
) -> Optional[float]:
    """
    DEPRECATED: Cross-game aggregate; compute from raw divergence if needed.
    """
    warnings.warn(
        "compute_consistency is deprecated.",
        DeprecationWarning,
        stacklevel=2
    )

    if divergence_mean is None or divergence_std is None:
        return None
    if divergence_mean == 0:
        return None

    cv = divergence_std / divergence_mean
    return max(0.0, 1.0 - cv)


def compute_llm_alignment(
    llm_convergence: Optional[float],
    stranger_convergence: Optional[float]
) -> Optional[float]:
    """
    DEPRECATED: Use compare_submissions() instead.
    """
    warnings.warn(
        "compute_llm_alignment is deprecated. Use compare_submissions instead.",
        DeprecationWarning,
        stacklevel=2
    )

    if llm_convergence is None or stranger_convergence is None:
        return None
    if stranger_convergence == 0:
        return None

    return llm_convergence / stranger_convergence


def classify_archetype(
    divergence: float,
    network_conv: float,
    stranger_conv: float,
    llm_conv: float
) -> str:
    """
    DEPRECATED: Dependent on deprecated convergence metrics.
    """
    warnings.warn(
        "classify_archetype is deprecated.",
        DeprecationWarning,
        stacklevel=2
    )

    high_div = divergence > 0.5
    high_network = network_conv > 0.6
    high_stranger = stranger_conv > 0.6

    if high_div and high_network and high_stranger:
        return "Creative Communicator"
    elif high_div and high_network and not high_stranger:
        return "In-Group Creator"
    elif high_div and not high_network and not high_stranger:
        return "Idiosyncratic"
    elif not high_div and high_network and high_stranger:
        return "Conventional Coordinator"
    else:
        return "Communication Difficulty"


# ============================================
# TEST CASES - Run with pytest
# ============================================

def test_cosine_similarity():
    """Test cosine similarity calculation."""
    # Identical vectors
    a = [1.0, 0.0, 0.0]
    assert abs(cosine_similarity(a, a) - 1.0) < 0.001

    # Orthogonal vectors
    a = [1.0, 0.0, 0.0]
    b = [0.0, 1.0, 0.0]
    assert abs(cosine_similarity(a, b) - 0.0) < 0.001

    # Opposite vectors
    a = [1.0, 0.0, 0.0]
    b = [-1.0, 0.0, 0.0]
    assert abs(cosine_similarity(a, b) - (-1.0)) < 0.001


def test_relevance_radiation():
    """Test INS-001.1 relevance (similarity to seed)."""
    seed = [1.0, 0.0, 0.0]

    # Clue in same direction as seed
    clue_relevant = [0.9, 0.1, 0.0]
    rel = cosine_similarity(clue_relevant, seed)
    assert rel > 0.9, f"Expected high relevance, got {rel}"

    # Clue orthogonal to seed
    clue_noise = [0.0, 1.0, 0.0]
    rel = cosine_similarity(clue_noise, seed)
    assert abs(rel) < 0.1, f"Expected low relevance, got {rel}"


def test_relevance_union():
    """Test INS-001.2 relevance (mean similarity to both endpoints)."""
    anchor = [1.0, 0.0, 0.0]
    target = [0.0, 1.0, 0.0]

    # Clue between both (45° from each)
    clue_relevant = [0.707, 0.707, 0.0]
    sim_a = cosine_similarity(clue_relevant, anchor)
    sim_t = cosine_similarity(clue_relevant, target)
    rel = (sim_a + sim_t) / 2
    assert rel > 0.5, f"Expected high relevance, got {rel}"

    # Clue orthogonal to both
    clue_noise = [0.0, 0.0, 1.0]
    sim_a = cosine_similarity(clue_noise, anchor)
    sim_t = cosine_similarity(clue_noise, target)
    rel = (sim_a + sim_t) / 2
    assert abs(rel) < 0.1, f"Expected low relevance, got {rel}"


def test_divergence_identical_clues():
    """Identical clues should have low divergence (only distance is to prompt)."""
    seed = [1.0, 0.0, 0.0]
    clues = [
        [0.0, 1.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 1.0, 0.0]
    ]
    div = calculate_divergence(clues, [seed])
    # All clues identical and orthogonal to seed
    # 3 pairs of (seed, clue) with distance 1.0, 3 pairs of (clue, clue) with distance 0
    # Mean = (1 + 1 + 1 + 0 + 0 + 0) / 6 = 0.5 → 50
    assert 45 < div < 55, f"Expected ~50 divergence, got {div}"


def test_divergence_orthogonal_clues():
    """Orthogonal clues should have high divergence."""
    seed = [1.0, 0.0, 0.0]
    clues = [
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
        [-1.0, 0.0, 0.0]  # Opposite to seed
    ]
    div = calculate_divergence(clues, [seed])
    # High spread: clues are orthogonal to each other AND vary in distance to seed
    assert div > 80, f"Expected high divergence for orthogonal clues, got {div}"


def test_divergence_similar_clues_near_seed():
    """Clues clustered near seed should have low divergence."""
    seed = [1.0, 0.0, 0.0]
    clues = [
        [0.95, 0.1, 0.0],
        [0.9, 0.15, 0.0],
        [0.92, 0.12, 0.0]
    ]
    div = calculate_divergence(clues, [seed])
    # All clues similar to each other AND close to seed
    assert div < 20, f"Expected low divergence for clustered clues near seed, got {div}"


def test_spread_clues_only():
    """Test INS-001.1 spread calculation (clues only, no seed)."""
    # Identical clues should have zero spread
    identical_clues = [
        [0.0, 1.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 1.0, 0.0]
    ]
    spread = calculate_spread_clues_only(identical_clues)
    assert spread < 1, f"Expected ~0 spread for identical clues, got {spread}"

    # Orthogonal clues should have high spread
    orthogonal_clues = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0]
    ]
    spread = calculate_spread_clues_only(orthogonal_clues)
    assert spread > 90, f"Expected high spread for orthogonal clues, got {spread}"

    # Single clue should return 0 (can't compute pairwise)
    single_clue = [[1.0, 0.0, 0.0]]
    spread = calculate_spread_clues_only(single_clue)
    assert spread == 0.0, f"Expected 0 spread for single clue, got {spread}"


def test_score_radiation():
    """Integration test for INS-001.1 scoring."""
    seed = [1.0, 0.0, 0.0]

    # Use more diverse clues to get meaningful spread
    clues = [
        [0.8, 0.6, 0.0],   # Relevant to seed, one direction
        [0.7, 0.0, 0.7],   # Relevant to seed, different direction
        [0.5, 0.5, 0.7],   # Relevant to seed, more different
    ]

    result = score_radiation(clues, seed)

    assert result["valid"] == True
    assert result["relevance"] > 0.3  # Should be relevant to seed
    assert "spread" in result  # INS-001.1 primary metric (clues-only)
    assert "divergence" in result  # DAT-style for comparison
    assert result["spread"] > 0  # Should have some spread among clues
    assert result["divergence"] > 0  # Should have some divergence (includes seed)
    assert len(result["relevance_individual"]) == 3


def test_score_union():
    """Integration test for INS-001.2 scoring."""
    anchor = [1.0, 0.0, 0.0]
    target = [0.0, 1.0, 0.0]

    clues = [
        [0.707, 0.707, 0.0],  # Between both
        [0.5, 0.5, 0.707],    # Off to the side, still somewhat relevant
    ]

    result = score_union(clues, anchor, target)

    assert result["valid"] == True
    assert result["relevance"] > 0.3
    # Spread is now clue-only (MTH-002.1 v2.0)
    assert "spread" in result
    assert result["spread"] > 0  # Two different clues should have some spread
    assert result["divergence"] == result["spread"]  # Alias for backwards compat
    assert len(result["relevance_individual"]) == 2


def test_bootstrap_null_distribution():
    """Test null distribution generation."""
    seed = [1.0, 0.0, 0.0]

    # Create a small fake vocabulary (random unit vectors)
    rng = np.random.default_rng(123)
    vocab = []
    for _ in range(100):
        v = rng.standard_normal(3)
        v = v / np.linalg.norm(v)  # Normalize
        vocab.append(v.tolist())

    null_dist = bootstrap_null_distribution(
        prompt_embeddings={"seed": seed},
        vocabulary_embeddings=vocab,
        n_clues=3,
        instrument="radiation",
        n_samples=100,  # Reduced for test speed
        seed=42
    )

    assert "relevance_mean" in null_dist
    assert "divergence_mean" in null_dist
    assert len(null_dist["relevance_samples"]) == 100
    assert len(null_dist["divergence_samples"]) == 100


def test_normalize_scores_percentile():
    """Test percentile normalization."""
    participant_scores = {
        "relevance": 0.5,
        "divergence": 85.0
    }

    null_dist = {
        "relevance_samples": [0.1, 0.2, 0.3, 0.4, 0.45] * 20,
        "divergence_samples": [60, 65, 70, 75, 80] * 20,
        "relevance_mean": 0.29,
        "relevance_std": 0.13,
        "divergence_mean": 70.0,
        "divergence_std": 7.5
    }

    result = normalize_scores(participant_scores, null_dist, method="percentile")

    assert result["relevance_normalized"] > 80
    assert result["divergence_normalized"] > 80
    assert result["relevance_raw"] == 0.5
    assert result["divergence_raw"] == 85.0


def test_normalize_scores_zscore():
    """Test z-score normalization."""
    participant_scores = {
        "relevance": 0.5,
        "divergence": 85.0
    }

    null_dist = {
        "relevance_samples": [],
        "divergence_samples": [],
        "relevance_mean": 0.3,
        "relevance_std": 0.1,
        "divergence_mean": 70.0,
        "divergence_std": 5.0
    }

    result = normalize_scores(participant_scores, null_dist, method="zscore")

    # (0.5 - 0.3) / 0.1 = 2.0
    assert abs(result["relevance_normalized"] - 2.0) < 0.01
    # (85 - 70) / 5 = 3.0
    assert abs(result["divergence_normalized"] - 3.0) < 0.01


def test_compare_submissions():
    """Test submission comparison."""
    participant = {
        "relevance": 0.5,
        "divergence": 80.0,
        "valid": True
    }

    baseline = {
        "relevance": 0.4,
        "divergence": 70.0,
        "valid": True
    }

    result = compare_submissions(participant, baseline)

    assert result["relevance_delta"] == 0.1
    assert result["divergence_delta"] == 10.0
    assert result["more_creative"] == True


# ============================================
# BRIDGING ALIASES AND HELPERS
# ============================================

# Alias for API consistency
score_bridging = score_union


def compute_bridge_similarity(
    bridge1_embeddings: list[list[float]],
    bridge2_embeddings: list[list[float]]
) -> float:
    """
    Compute similarity between two bridges (sets of clue embeddings).

    Uses centroid-based comparison: compute centroid of each bridge,
    then return cosine similarity between centroids.

    Args:
        bridge1_embeddings: Embeddings for first bridge's clues
        bridge2_embeddings: Embeddings for second bridge's clues

    Returns:
        Similarity score (0-1, where 1 = identical direction)
    """
    if not bridge1_embeddings or not bridge2_embeddings:
        return 0.0

    # Compute centroids
    centroid1 = np.mean(np.array(bridge1_embeddings), axis=0)
    centroid2 = np.mean(np.array(bridge2_embeddings), axis=0)

    # Return similarity (convert from [-1, 1] to [0, 1] range)
    sim = cosine_similarity(centroid1.tolist(), centroid2.tolist())
    return float((sim + 1) / 2)  # Map [-1, 1] to [0, 1]


def test_interpretation_helpers():
    """Test interpretation helper functions."""
    # Relevance interpretations
    assert get_relevance_interpretation(0.10) == "Noise"
    assert get_relevance_interpretation(0.20) == "Weak"
    assert get_relevance_interpretation(0.35) == "Moderate"
    assert get_relevance_interpretation(0.50) == "Strong"

    # Divergence interpretations (DAT-style, used by INS-001.2)
    assert get_divergence_interpretation(40) == "Low"
    assert get_divergence_interpretation(60) == "Below Average"
    assert get_divergence_interpretation(75) == "Average"
    assert get_divergence_interpretation(85) == "Above Average"
    assert get_divergence_interpretation(95) == "High"

    # Spread interpretations (INS-001.1 clues-only, normalized 20-80 range)
    # Raw 20-80 maps to normalized 0-100
    # Bands: normalized <33=Low, 33-66=Medium, >66=High
    # Raw thresholds: <40=Low, 40-60=Medium, >60=High
    assert get_spread_interpretation_ins001_1(30) == "Low"      # normalized 16.7%
    assert get_spread_interpretation_ins001_1(50) == "Medium"   # normalized 50%
    assert get_spread_interpretation_ins001_1(65) == "High"     # normalized 75%


if __name__ == "__main__":
    test_cosine_similarity()
    test_relevance_radiation()
    test_relevance_union()
    test_divergence_identical_clues()
    test_divergence_orthogonal_clues()
    test_divergence_similar_clues_near_seed()
    test_spread_clues_only()  # INS-001.1 clues-only spread
    test_score_radiation()
    test_score_union()
    test_bootstrap_null_distribution()
    test_normalize_scores_percentile()
    test_normalize_scores_zscore()
    test_compare_submissions()
    test_interpretation_helpers()
    print("All tests passed!")
