"""
Scoring Algorithms - INS-001 Semantic Associations

This module implements the unified scoring framework for both:
- INS-001.1 (Semantic Radiation): Single seed word, clues radiate outward
- INS-001.2 (Semantic Union): Anchor-target pair, clues bridge between them

INS-001.1 uses two metrics:
1. **Relevance** — Are the clues semantically connected to the seed?
2. **Spread** — How spread out are the clues from each other? (clues-only)

INS-001.2 uses two metrics:
1. **Fidelity** — How well do clues jointly identify the anchor-target pair?
   Uses joint constraint scoring: coverage (foils eliminated) × efficiency (non-redundancy)
2. **Spread** — How spread out are the clues from each other? (clues-only, DAT-style)

Interpretation for INS-001.2:
- "Spread: how far apart your clues are from each other"
- "Fidelity: how well your clues jointly identify the anchor-target pair"

Literature basis:
- Fidelity: Joint constraint scoring (eliminates foil neighbors)
- Spread/Divergence: Divergent Association Task (Olson et al., 2021, PNAS)
"""

import numpy as np
from typing import Optional
from scipy.optimize import linear_sum_assignment


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
    target_embedding: list[float],
    vocabulary_embeddings: Optional[list[list[float]]] = None
) -> dict:
    """
    Score a participant's semantic union submission (INS-001.2).

    Fidelity: How well clues jointly identify the anchor-target pair.
    Uses joint constraint scoring: measures coverage (how many foils eliminated)
    and efficiency (are clues non-redundant). See compute_fidelity() for details.

    Spread: Mean pairwise distance among clues only (excludes anchor/target).
    This isolates participant performance from pair difficulty and aligns with
    the DAT methodology which only uses participant-generated words.

    Relevance (legacy): How connected are clues to BOTH anchor and target?
    Uses min(sim_anchor, sim_target). Kept for backwards compatibility.

    See MTH-002.1 v2.0 Section 3.1 for methodology details.

    Args:
        clue_embeddings: List of embedding vectors for submitted clues
        anchor_embedding: Embedding vector for anchor concept
        target_embedding: Embedding vector for target concept
        vocabulary_embeddings: Optional pool of vocabulary embeddings for fidelity calculation

    Returns:
        Dictionary with:
        - fidelity: Overall fidelity score (coverage * efficiency, 0-1)
        - fidelity_valid: Whether submission passes fidelity threshold
        - coverage: Fraction of foils eliminated by at least one clue
        - efficiency: 1 - redundancy measure
        - spread: Clue-only spread (0-100, excludes anchor/target)
        - divergence: Alias for spread (for backwards compatibility)
        - relevance: Legacy relevance score (mean of min(sim_a, sim_t) per clue)
        - relevance_individual: Per-clue relevance scores (legacy)
        - valid: Whether submission passes fidelity threshold (replaces relevance-based validity)
    """
    if not clue_embeddings:
        return {
            "fidelity": 0.0,
            "fidelity_valid": False,
            "coverage": 0.0,
            "efficiency": 0.0,
            "relevance": 0.0,
            "relevance_individual": [],
            "spread": 0.0,
            "divergence": 0.0,
            "valid": False
        }

    # Fidelity: joint constraint score (primary metric)
    if vocabulary_embeddings:
        fidelity_result = compute_fidelity(
            clue_embeddings, anchor_embedding, target_embedding, vocabulary_embeddings
        )
        fidelity = fidelity_result["fidelity"]
        fidelity_valid = fidelity_result["fidelity_valid"]
        coverage = fidelity_result["coverage"]
        efficiency = fidelity_result["efficiency"]
    else:
        # If no vocabulary provided, fall back to relevance-based validity
        fidelity = 0.0
        fidelity_valid = False
        coverage = 0.0
        efficiency = 0.0

    # Relevance (legacy): min similarity to both endpoints
    # Kept for backwards compatibility
    relevance_scores = []
    for clue in clue_embeddings:
        sim_a = cosine_similarity(clue, anchor_embedding)
        sim_t = cosine_similarity(clue, target_embedding)
        relevance_scores.append(min(sim_a, sim_t))

    overall_relevance = float(np.mean(relevance_scores))

    # Spread: clue-only pairwise distance (MTH-002.1 v2.0)
    # This isolates participant contribution from pair difficulty
    overall_spread = calculate_spread_clues_only(clue_embeddings)

    # Validity: use fidelity if available, otherwise fall back to relevance
    if vocabulary_embeddings:
        valid = fidelity_valid
    else:
        valid = overall_relevance >= RELEVANCE_THRESHOLD

    return {
        "fidelity": fidelity,
        "fidelity_valid": fidelity_valid,
        "coverage": coverage,
        "efficiency": efficiency,
        "relevance": overall_relevance,
        "relevance_individual": relevance_scores,
        "spread": overall_spread,
        "divergence": overall_spread,  # Alias for backwards compatibility
        "valid": valid
    }


# ============================================
# INS-001.2: FIDELITY (Joint Constraint Score)
# ============================================

# Minimum fidelity score for a submission to be considered valid
# Submissions below this threshold indicate clues don't constrain the solution space
FIDELITY_THRESHOLD = 0.50


def get_nearest_neighbors(
    target_embedding: list[float],
    vocabulary_embeddings: list[list[float]],
    n: int = 50
) -> list[list[float]]:
    """
    Get the n nearest neighbors to a target embedding from vocabulary.

    Args:
        target_embedding: The embedding to find neighbors for
        vocabulary_embeddings: Pool of candidate embeddings
        n: Number of neighbors to return

    Returns:
        List of n embedding vectors closest to target
    """
    if not vocabulary_embeddings:
        return []

    # Compute similarities to all vocabulary words
    similarities = []
    for i, emb in enumerate(vocabulary_embeddings):
        sim = cosine_similarity(target_embedding, emb)
        similarities.append((sim, i))

    # Sort by similarity (descending) and take top n
    similarities.sort(reverse=True, key=lambda x: x[0])
    neighbors = [vocabulary_embeddings[idx] for _, idx in similarities[:n]]

    return neighbors


def compute_fidelity(
    clue_embeddings: list[list[float]],
    anchor_embedding: list[float],
    target_embedding: list[float],
    vocabulary_embeddings: list[list[float]],
    n_foils: int = 50
) -> dict:
    """
    Compute fidelity score using joint constraint algorithm.

    Fidelity measures how well the clues collectively narrow down the anchor-target pair.
    Good clues should each eliminate different wrong answers (foils).

    Algorithm:
    1. Get n nearest neighbors as foils for both anchor and target
    2. For each clue, determine which foils it "eliminates"
       (clue is closer to true anchor/target than to foil)
    3. Coverage = fraction of foils eliminated by at least one clue
    4. Efficiency = 1 - redundancy (how much clues overlap in eliminations)
    5. Fidelity = coverage * efficiency

    Args:
        clue_embeddings: List of embedding vectors for submitted clues
        anchor_embedding: Embedding vector for anchor concept
        target_embedding: Embedding vector for target concept
        vocabulary_embeddings: Pool of vocabulary embeddings for finding foils
        n_foils: Number of foil neighbors to use (default 50)

    Returns:
        Dictionary with:
        - fidelity: Overall fidelity score (coverage * efficiency, 0-1)
        - coverage: Fraction of foils eliminated by at least one clue
        - efficiency: 1 - redundancy measure
        - anchor_coverage: Coverage for anchor foils
        - target_coverage: Coverage for target foils
        - fidelity_valid: Whether submission passes fidelity threshold
    """
    if not clue_embeddings or not vocabulary_embeddings:
        return {
            "fidelity": 0.0,
            "coverage": 0.0,
            "efficiency": 0.0,
            "anchor_coverage": 0.0,
            "target_coverage": 0.0,
            "fidelity_valid": False
        }

    # Get foil neighbors for anchor and target
    foil_anchors = get_nearest_neighbors(anchor_embedding, vocabulary_embeddings, n_foils)
    foil_targets = get_nearest_neighbors(target_embedding, vocabulary_embeddings, n_foils)

    if not foil_anchors or not foil_targets:
        return {
            "fidelity": 0.0,
            "coverage": 0.0,
            "efficiency": 0.0,
            "anchor_coverage": 0.0,
            "target_coverage": 0.0,
            "fidelity_valid": False
        }

    # For each clue, compute which foils it eliminates
    anchor_eliminations = []
    target_eliminations = []

    for clue in clue_embeddings:
        clue_to_anchor = cosine_similarity(clue, anchor_embedding)
        clue_to_target = cosine_similarity(clue, target_embedding)

        # A foil is "eliminated" if clue is closer to true anchor than to foil
        a_elim = set()
        for i, foil in enumerate(foil_anchors):
            clue_to_foil = cosine_similarity(clue, foil)
            if clue_to_anchor > clue_to_foil:
                a_elim.add(i)

        # A foil is "eliminated" if clue is closer to true target than to foil
        t_elim = set()
        for i, foil in enumerate(foil_targets):
            clue_to_foil = cosine_similarity(clue, foil)
            if clue_to_target > clue_to_foil:
                t_elim.add(i)

        anchor_eliminations.append(a_elim)
        target_eliminations.append(t_elim)

    # Measure coverage: what fraction of foils are eliminated by at least one clue?
    anchor_union = set.union(*anchor_eliminations) if anchor_eliminations else set()
    target_union = set.union(*target_eliminations) if target_eliminations else set()

    anchor_coverage = len(anchor_union) / len(foil_anchors) if foil_anchors else 0.0
    target_coverage = len(target_union) / len(foil_targets) if foil_targets else 0.0
    coverage = (anchor_coverage + target_coverage) / 2

    # Measure efficiency: are clues non-redundant?
    # Redundancy = intersection / union (how much overlap)
    if anchor_union:
        anchor_intersection = set.intersection(*anchor_eliminations)
        anchor_redundancy = len(anchor_intersection) / len(anchor_union)
    else:
        anchor_redundancy = 0.0

    if target_union:
        target_intersection = set.intersection(*target_eliminations)
        target_redundancy = len(target_intersection) / len(target_union)
    else:
        target_redundancy = 0.0

    efficiency = 1 - (anchor_redundancy + target_redundancy) / 2

    # Joint score = coverage * efficiency
    fidelity = coverage * efficiency

    return {
        "fidelity": float(fidelity),
        "coverage": float(coverage),
        "efficiency": float(efficiency),
        "anchor_coverage": float(anchor_coverage),
        "target_coverage": float(target_coverage),
        "fidelity_valid": fidelity >= FIDELITY_THRESHOLD
    }


def get_fidelity_interpretation(score: float) -> str:
    """
    Get human-readable interpretation of fidelity score.

    Scale:
    - < 0.50: Poor - Clues don't constrain the solution space
    - 0.50-0.65: Below Average - Some constraint, high redundancy
    - 0.65-0.75: Average - Reasonable triangulation
    - 0.75-0.85: Above Average - Efficient, complementary clues
    - > 0.85: Excellent - Near-optimal constraint coverage

    Args:
        score: Fidelity score (0-1)

    Returns:
        Interpretation label
    """
    if score < 0.50:
        return "Poor"
    elif score < 0.65:
        return "Below Average"
    elif score < 0.75:
        return "Average"
    elif score < 0.85:
        return "Above Average"
    else:
        return "Excellent"


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
    """Integration test for INS-001.2 scoring (without vocabulary)."""
    anchor = [1.0, 0.0, 0.0]
    target = [0.0, 1.0, 0.0]

    clues = [
        [0.707, 0.707, 0.0],  # Between both
        [0.5, 0.5, 0.707],    # Off to the side, still somewhat relevant
    ]

    # Test without vocabulary (legacy mode)
    result = score_union(clues, anchor, target)

    assert result["relevance"] > 0.3
    # Spread is now clue-only (MTH-002.1 v2.0)
    assert "spread" in result
    assert result["spread"] > 0  # Two different clues should have some spread
    assert result["divergence"] == result["spread"]  # Alias for backwards compat
    assert len(result["relevance_individual"]) == 2
    # Without vocabulary, fidelity should be 0
    assert result["fidelity"] == 0.0


def test_score_union_with_fidelity():
    """Integration test for INS-001.2 scoring with fidelity calculation."""
    anchor = [1.0, 0.0, 0.0]
    target = [0.0, 1.0, 0.0]

    # Clues that bridge between anchor and target
    clues = [
        [0.707, 0.707, 0.0],  # Between both
        [0.5, 0.5, 0.707],    # Off to the side, still somewhat relevant
        [0.6, 0.8, 0.0],      # Closer to target
    ]

    # Create vocabulary pool (random unit vectors)
    rng = np.random.default_rng(42)
    vocab = []
    for _ in range(100):
        v = rng.standard_normal(3)
        v = v / np.linalg.norm(v)  # Normalize
        vocab.append(v.tolist())

    result = score_union(clues, anchor, target, vocabulary_embeddings=vocab)

    # With vocabulary, fidelity should be computed
    assert "fidelity" in result
    assert "fidelity_valid" in result
    assert "coverage" in result
    assert "efficiency" in result
    assert result["fidelity"] >= 0 and result["fidelity"] <= 1
    # Still have legacy fields
    assert "relevance" in result
    assert "spread" in result


def test_compute_fidelity():
    """Test fidelity computation directly."""
    anchor = [1.0, 0.0, 0.0]
    target = [0.0, 1.0, 0.0]

    # Good clues that should eliminate many foils
    good_clues = [
        [0.8, 0.2, 0.0],  # Close to anchor
        [0.2, 0.8, 0.0],  # Close to target
        [0.5, 0.5, 0.0],  # Between both
    ]

    # Create vocabulary pool
    rng = np.random.default_rng(42)
    vocab = []
    for _ in range(100):
        v = rng.standard_normal(3)
        v = v / np.linalg.norm(v)
        vocab.append(v.tolist())

    result = compute_fidelity(good_clues, anchor, target, vocab)

    assert result["fidelity"] >= 0 and result["fidelity"] <= 1
    assert result["coverage"] >= 0 and result["coverage"] <= 1
    assert result["efficiency"] >= 0 and result["efficiency"] <= 1
    assert result["anchor_coverage"] >= 0
    assert result["target_coverage"] >= 0


def test_get_nearest_neighbors():
    """Test nearest neighbor retrieval."""
    target = [1.0, 0.0, 0.0]
    vocab = [
        [0.9, 0.1, 0.0],   # Very close to target
        [0.0, 1.0, 0.0],   # Orthogonal
        [0.8, 0.2, 0.0],   # Close to target
        [-1.0, 0.0, 0.0],  # Opposite
    ]

    neighbors = get_nearest_neighbors(target, vocab, n=2)
    assert len(neighbors) == 2
    # First neighbor should be the closest one
    assert neighbors[0] == [0.9, 0.1, 0.0]
    assert neighbors[1] == [0.8, 0.2, 0.0]


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

    assert abs(result["relevance_delta"] - 0.1) < 0.001
    assert abs(result["divergence_delta"] - 10.0) < 0.001
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
    # Relevance interpretations (legacy, used by INS-001.1)
    assert get_relevance_interpretation(0.10) == "Noise"
    assert get_relevance_interpretation(0.20) == "Weak"
    assert get_relevance_interpretation(0.35) == "Moderate"
    assert get_relevance_interpretation(0.50) == "Strong"

    # Fidelity interpretations (INS-001.2 primary metric)
    assert get_fidelity_interpretation(0.40) == "Poor"
    assert get_fidelity_interpretation(0.55) == "Below Average"
    assert get_fidelity_interpretation(0.70) == "Average"
    assert get_fidelity_interpretation(0.80) == "Above Average"
    assert get_fidelity_interpretation(0.90) == "Excellent"

    # Divergence interpretations (DAT-style)
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


# ============================================
# PAPER FORMULATIONS — Studies Scoring
# Scale-invariant metrics from:
# "Measuring Constructive Creativity in AI-Augmented Work" (Patel, 2026)
# ============================================

def _similarity_matrix(targets: np.ndarray, associations: np.ndarray) -> np.ndarray:
    """
    Build m×n cosine similarity matrix.

    Args:
        targets: (m, d) array of target embeddings
        associations: (n, d) array of association embeddings

    Returns:
        (m, n) similarity matrix where S[i,j] = sim(t_i, a_j)
    """
    t_norms = np.linalg.norm(targets, axis=1, keepdims=True)
    a_norms = np.linalg.norm(associations, axis=1, keepdims=True)
    t_norms = np.where(t_norms == 0, 1, t_norms)
    a_norms = np.where(a_norms == 0, 1, a_norms)
    t_norm = targets / t_norms
    a_norm = associations / a_norms
    return t_norm @ a_norm.T


def bipartite_fit(targets: np.ndarray, associations: np.ndarray) -> float:
    """
    Optimal one-to-one matching via Hungarian algorithm.

    fit(T, A) = (1 / min(m, n)) * sum_{(i,j) in M*} S_ij

    Args:
        targets: (m, d) array
        associations: (n, d) array

    Returns:
        Mean similarity of optimal matching.
    """
    S = _similarity_matrix(targets, associations)
    row_ind, col_ind = linear_sum_assignment(-S)
    matched_sims = S[row_ind, col_ind]
    return float(np.mean(matched_sims))


def compute_alignment(
    targets: np.ndarray,
    associations: np.ndarray,
    foil_sets: list[np.ndarray],
) -> dict:
    """
    Alignment via foil comparison, with continuous z-score variant.

    Returns three values:
    - a_scaled: published binary rank metric (proportion of foils beaten)
    - a_z: continuous z-score of true fit within foil fit distribution
    - a_display: sigmoid-mapped 0-100 score for visualization

    Args:
        targets: (m, d) array of true target embeddings
        associations: (n, d) array of association embeddings
        foil_sets: List of k arrays, each (m, d) — random foil target sets

    Returns:
        Dict with a_scaled, a_z (nullable), and a_display.
    """
    if not foil_sets:
        return {"a_scaled": 0.5, "a_z": None, "a_display": 50.0}

    true_fit = bipartite_fit(targets, associations)
    foil_fits = [bipartite_fit(f, associations) for f in foil_sets]

    # Published metric (unchanged)
    a_scaled = sum(1 for f in foil_fits if f < true_fit) / len(foil_fits)

    # Continuous variant: z-score within foil distribution
    mu = np.mean(foil_fits)
    sigma = np.std(foil_fits)

    if sigma < 1e-3:
        # Near-zero variance — z-score unstable, fall back to percentile
        a_z = None
        a_display = a_scaled * 100
    else:
        a_z = float((true_fit - mu) / sigma)
        # Sigmoid mapping: c=1.5 centers "decent" at 50, beta=0.8 controls slope
        c, beta = 1.5, 0.8
        a_display = float(100 / (1 + np.exp(-beta * (a_z - c))))

    return {"a_scaled": a_scaled, "a_z": a_z, "a_display": a_display}


def compute_alignment_simple(
    targets: np.ndarray,
    association: np.ndarray,
) -> float:
    """
    Simple alignment for RAT items (n=1): mean cosine similarity
    between the single association and each target.

    Args:
        targets: (m, d) array of target embeddings (RAT cue words)
        association: (d,) single association embedding

    Returns:
        Mean similarity in [-1, 1].
    """
    sims = []
    a = association / (np.linalg.norm(association) or 1)
    for t in targets:
        t_n = t / (np.linalg.norm(t) or 1)
        sims.append(float(np.dot(t_n, a)))
    return float(np.mean(sims))


def generate_foil_sets(
    m: int,
    vocab_embeddings: np.ndarray,
    k: int = 100,
    seed: int = 42,
) -> list[np.ndarray]:
    """
    Draw k random foil sets from vocabulary, each containing m words.
    Precompute once per (m, study) — not per participant.

    Args:
        m: Number of targets to match
        vocab_embeddings: (V, d) array of vocabulary embeddings
        k: Number of foil sets
        seed: Random seed for reproducibility

    Returns:
        List of k arrays, each (m, d)
    """
    rng = np.random.default_rng(seed)
    V = len(vocab_embeddings)
    foil_sets = []
    for _ in range(k):
        indices = rng.choice(V, size=m, replace=False)
        foil_sets.append(vocab_embeddings[indices])
    return foil_sets


def _max_sim_fit(associations: np.ndarray, targets: np.ndarray) -> float:
    """
    fit(A, T) = (1/m) * sum_i max_j sim(t_i, a_j)

    For each target, find the best-matching association.
    """
    S = _similarity_matrix(targets, associations)  # (m, n)
    return float(np.mean(np.max(S, axis=1)))


def compute_parsimony(
    targets: np.ndarray,
    associations: np.ndarray,
) -> float:
    """
    Parsimony via leave-one-out marginal contribution.

    P = mean(delta) / max(delta)
    where delta_j = fit(A, T) - fit(A_{-j}, T)

    Args:
        targets: (m, d) array
        associations: (n, d) array

    Returns:
        Parsimony in [1/n, 1]. 1.0 = all associations contribute equally.
        Returns 1.0 for n=1 or if max(delta) <= 0.
    """
    n = len(associations)
    if n <= 1:
        return 1.0

    full_fit = _max_sim_fit(associations, targets)
    deltas = []
    for j in range(n):
        reduced = np.delete(associations, j, axis=0)
        reduced_fit = _max_sim_fit(reduced, targets)
        deltas.append(full_fit - reduced_fit)

    deltas = np.array(deltas)
    max_delta = np.max(deltas)

    if max_delta <= 0:
        return 1.0

    return float(np.mean(deltas) / max_delta)


def compute_recovery_mrr(
    targets: np.ndarray,
    associations: np.ndarray,
    vocab_embeddings: np.ndarray,
) -> float:
    """
    Mean Reciprocal Rank of true targets when vocabulary is ranked
    by maximum similarity to any association.

    Rec-MRR = (1/m) * sum_i 1/(rank_i + 1)

    Args:
        targets: (m, d) array of target embeddings
        associations: (n, d) array of association embeddings
        vocab_embeddings: (V, d) array — full vocabulary

    Returns:
        Recovery MRR score. Higher = associations make targets more identifiable.
    """
    v_norms = np.linalg.norm(vocab_embeddings, axis=1, keepdims=True)
    a_norms = np.linalg.norm(associations, axis=1, keepdims=True)
    v_norms = np.where(v_norms == 0, 1, v_norms)
    a_norms = np.where(a_norms == 0, 1, a_norms)
    v_norm = vocab_embeddings / v_norms
    a_norm = associations / a_norms

    # (V, n) similarity matrix → max per vocab word
    sim = v_norm @ a_norm.T
    max_sim = np.max(sim, axis=1)  # (V,)

    # Each target's max-sim score
    t_norms = np.linalg.norm(targets, axis=1, keepdims=True)
    t_norms = np.where(t_norms == 0, 1, t_norms)
    t_norm = targets / t_norms
    target_sims = t_norm @ a_norm.T  # (m, n)
    target_max_sims = np.max(target_sims, axis=1)  # (m,)

    # Reciprocal rank: count vocab words with higher score
    reciprocal_ranks = []
    for t_score in target_max_sims:
        rank = int(np.sum(max_sim > t_score))
        reciprocal_ranks.append(1.0 / (rank + 1))

    return float(np.mean(reciprocal_ranks))


def score_study_dat(association_embeddings: np.ndarray) -> dict:
    """
    Score a DAT submission for a study (free association, no targets).
    Uses existing calculate_spread_clues_only for 0-100 scale divergence.
    """
    emb_list = [e.tolist() if isinstance(e, np.ndarray) else e for e in association_embeddings]
    return {
        "divergence": calculate_spread_clues_only(emb_list),
    }


def score_study_rat(
    target_embeddings: np.ndarray,
    association_embedding: np.ndarray,
    solution: Optional[str] = None,
    submitted_word: Optional[str] = None,
) -> dict:
    """
    Score a RAT submission for a study (n=1 association, m=3 cues).
    Uses simple alignment (mean cosine similarity to targets).

    Args:
        target_embeddings: (m, d) array of RAT cue embeddings
        association_embedding: (d,) single submitted word embedding
        solution: canonical answer (e.g., "blue")
        submitted_word: what the participant typed

    Returns:
        Dict with alignment and exact_match.
    """
    alignment = compute_alignment_simple(target_embeddings, association_embedding)
    exact_match = (
        submitted_word is not None
        and solution is not None
        and submitted_word.strip().lower() == solution.strip().lower()
    )
    return {
        "alignment": alignment,
        "exact_match": exact_match,
    }


def score_study_bridge(
    target_embeddings: np.ndarray,
    association_embeddings: np.ndarray,
    foil_sets: list[np.ndarray],
    vocab_embeddings: Optional[np.ndarray] = None,
) -> dict:
    """
    Score a Bridge submission for a study using paper formulations.

    Args:
        target_embeddings: (m, d) array
        association_embeddings: (n, d) array
        foil_sets: Precomputed foil sets for alignment
        vocab_embeddings: Optional (V, d) array for recovery computation

    Returns:
        Dict with divergence, alignment, parsimony, and optionally recovery_mrr.
    """
    emb_list = [e.tolist() if isinstance(e, np.ndarray) else e for e in association_embeddings]
    alignment = compute_alignment(target_embeddings, association_embeddings, foil_sets)
    result = {
        "divergence": calculate_spread_clues_only(emb_list),
        "alignment": alignment["a_scaled"],
        "alignment_z": alignment["a_z"],
        "alignment_display": alignment["a_display"],
        "parsimony": compute_parsimony(target_embeddings, association_embeddings),
    }
    if vocab_embeddings is not None:
        result["recovery_mrr"] = compute_recovery_mrr(
            target_embeddings, association_embeddings, vocab_embeddings
        )
    return result


# ============================================
# In-memory foil set cache for studies
# ============================================

_foil_cache: dict[tuple[str, int], list[np.ndarray]] = {}

def get_or_create_foil_sets(
    study_slug: str,
    m: int,
    vocab_embeddings: np.ndarray,
    k: int = 100,
    seed: int = 42,
) -> list[np.ndarray]:
    """
    Get cached foil sets or generate and cache them.
    Keyed by (study_slug, m) — one set per target count per study.
    """
    key = (study_slug, m)
    if key not in _foil_cache:
        _foil_cache[key] = generate_foil_sets(m, vocab_embeddings, k=k, seed=seed)
    return _foil_cache[key]


# ============================================
# TESTS — Paper Formulations
# ============================================

def test_bipartite_fit():
    targets = np.array([[1, 0, 0], [0, 1, 0]], dtype=float)
    assoc_good = np.array([[1, 0, 0], [0, 1, 0]], dtype=float)
    assert bipartite_fit(targets, assoc_good) > 0.99
    assoc_bad = np.array([[0, 0, 1], [0, 0, 1]], dtype=float)
    assert bipartite_fit(targets, assoc_bad) < 0.01


def test_alignment():
    rng = np.random.default_rng(42)
    d = 50
    targets = rng.standard_normal((3, d))
    good_assoc = targets + rng.standard_normal((3, d)) * 0.1
    vocab = rng.standard_normal((500, d))
    foils = generate_foil_sets(3, vocab, k=50, seed=42)
    result = compute_alignment(targets, good_assoc, foils)
    assert isinstance(result, dict), f"Expected dict, got {type(result)}"
    assert result["a_scaled"] > 0.8, f"Expected high a_scaled, got {result['a_scaled']}"
    assert result["a_z"] is not None, "Expected a_z to be computed"
    assert result["a_z"] > 1.0, f"Expected positive a_z for good associations, got {result['a_z']}"
    assert 0 <= result["a_display"] <= 100, f"a_display out of range: {result['a_display']}"

    # Bad associations should score lower on display
    bad_assoc = rng.standard_normal((3, d))
    result_bad = compute_alignment(targets, bad_assoc, foils)
    assert result["a_display"] > result_bad["a_display"], \
        f"Good assoc display ({result['a_display']:.1f}) should beat bad ({result_bad['a_display']:.1f})"


def test_parsimony():
    targets = np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1]], dtype=float)
    assoc_diverse = np.array([[1, 0, 0], [0, 1, 0], [0, 0, 1]], dtype=float)
    p = compute_parsimony(targets, assoc_diverse)
    assert p > 0.9, f"Expected high parsimony, got {p}"
    assert compute_parsimony(targets, np.array([[1, 0, 0]], dtype=float)) == 1.0
    assoc_identical = np.array([[1, 0, 0], [1, 0, 0], [1, 0, 0]], dtype=float)
    assert compute_parsimony(targets, assoc_identical) == 1.0


def test_recovery_mrr():
    rng = np.random.default_rng(42)
    d = 50
    targets = rng.standard_normal((3, d))
    good_assoc = targets + rng.standard_normal((3, d)) * 0.05
    vocab = rng.standard_normal((200, d))
    mrr = compute_recovery_mrr(targets, good_assoc, vocab)
    assert mrr > 0.1, f"Expected decent MRR, got {mrr}"


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
    test_score_union_with_fidelity()  # INS-001.2 with fidelity
    test_compute_fidelity()
    test_get_nearest_neighbors()
    test_bootstrap_null_distribution()
    test_normalize_scores_percentile()
    test_normalize_scores_zscore()
    test_compare_submissions()
    test_interpretation_helpers()
    test_bipartite_fit()
    test_alignment()
    test_parsimony()
    test_recovery_mrr()
    print("All tests passed!")
