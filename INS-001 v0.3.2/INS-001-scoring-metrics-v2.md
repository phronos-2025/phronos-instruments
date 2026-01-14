# INS-001 Scoring Metrics Specification

## Overview

Both INS-001.1 (Semantic Radiation) and INS-001.2 (Semantic Union) use exactly **two metrics** to evaluate participant-submitted concepts:

1. **Relevance** — Are the clues semantically connected to the prompt?
2. **Divergence** — How spread out are the clues from each other?

These metrics are orthogonal:
- High relevance + high divergence = creative but valid
- High relevance + low divergence = predictable/conventional  
- Low relevance = noise (divergence becomes meaningless)

**Key insight:** Divergence uses the same formula for both instruments (DAT-style mean pairwise distance). Only relevance differs based on task geometry.

| | Relevance | Divergence |
|---|---|---|
| **INS-001.1** (Radiation) | mean similarity to seed | mean pairwise distance between clues |
| **INS-001.2** (Union) | mean(sim_anchor, sim_target) | mean pairwise distance between clues |

**Literature basis:** The divergence metric follows the Divergent Association Task (Olson et al., 2021, PNAS), which validated mean pairwise semantic distance as a measure of divergent thinking. DAT scores correlate with established creativity measures and take only minutes to administer.

---

## Metric 1: Relevance

**Purpose:** Distinguish signal from noise. A clue is relevant if it's semantically connected to the prompt (seed for INS-001.1, anchor-target pair for INS-001.2).

### INS-001.1 (Radiation): Similarity to Seed

```python
def calculate_relevance_radiation(
    clue_embedding: list[float],
    seed_embedding: list[float]
) -> float:
    """
    INS-001.1: How semantically connected is this clue to the seed topic?
    
    Args:
        clue_embedding: Embedding vector for the clue
        seed_embedding: Embedding vector for seed concept
        
    Returns:
        Relevance score in range [-1, 1] (typically 0 to 1 for meaningful associations)
        Higher = more connected to seed
    """
    return cosine_similarity(clue_embedding, seed_embedding)
```

### INS-001.2 (Union): Mean Similarity to Both Endpoints

```python
def calculate_relevance_union(
    clue_embedding: list[float],
    anchor_embedding: list[float],
    target_embedding: list[float]
) -> float:
    """
    INS-001.2: How semantically connected is this clue to the anchor-target pair?
    
    Args:
        clue_embedding: Embedding vector for the clue
        anchor_embedding: Embedding vector for anchor concept
        target_embedding: Embedding vector for target concept
        
    Returns:
        Relevance score in range [-1, 1] (typically 0 to 1 for meaningful associations)
        Higher = more connected to both endpoints
    """
    sim_anchor = cosine_similarity(clue_embedding, anchor_embedding)
    sim_target = cosine_similarity(clue_embedding, target_embedding)
    return (sim_anchor + sim_target) / 2
```

### Interpretation Thresholds

(Calibrate empirically, starting point):

| Score | Interpretation |
|-------|----------------|
| < 0.15 | Noise / unrelated |
| 0.15–0.30 | Weak (tangential) |
| 0.30–0.45 | Moderate (connected) |
| > 0.45 | Strong (core neighborhood) |

**Literature basis:**
- Standard in information retrieval: query-document relevance with multi-term queries uses additive/mean combination
- Distributional semantics: semantic neighborhood defined by average proximity to reference points

---

## Metric 2: Divergence

**Purpose:** Measure creativity/spread. How much semantic territory does the full set of words cover?

**Formula:** Mean pairwise cosine distance between all words (clues + prompt words), scaled to 0-100.

This follows the Divergent Association Task (DAT) methodology, which has been validated against established creativity measures. By including the prompt words (seed for INS-001.1, anchor+target for INS-001.2), the score captures both:
- How spread out the clues are from each other
- How far the clues range from the prompt (and for INS-001.2, the difficulty of the pair)

```python
def calculate_divergence(
    clue_embeddings: list[list[float]],
    prompt_embeddings: list[list[float]]
) -> float:
    """
    Mean pairwise cosine distance between all words (clues + prompt).
    Works for both INS-001.1 and INS-001.2.
    
    Args:
        clue_embeddings: List of embedding vectors for submitted clues
        prompt_embeddings: Embeddings for prompt words
            - INS-001.1: [seed_embedding]
            - INS-001.2: [anchor_embedding, target_embedding]
        
    Returns:
        Divergence score (0-100 scale, following DAT convention)
        0 = all words identical
        100 = words maximally distant (theoretical; ~95 is practical max)
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
```

**Pairs calculated:**

| Instrument | With 3 clues | Pairs |
|------------|--------------|-------|
| INS-001.1 | seed + 3 clues | 6 pairs: S-c1, S-c2, S-c3, c1-c2, c1-c3, c2-c3 |
| INS-001.2 | anchor + target + 3 clues | 10 pairs: A-T, A-c1, A-c2, A-c3, T-c1, T-c2, T-c3, c1-c2, c1-c3, c2-c3 |

**Interpretation thresholds** (calibrated from DAT norms):

| Score | Interpretation |
|-------|----------------|
| < 50 | Low (often indicates misunderstanding, e.g., listing synonyms) |
| 50–65 | Below average |
| 65–80 | Average |
| 80–90 | Above average |
| > 90 | High (very spread out associations) |

**Note:** DAT scores "can be intuitively thought of as a grade on an examination; under 50 is poor, the average is between 75 and 80, and 95 is a very high score."

**Literature basis:**
- Olson et al. (2021), PNAS: "Naming unrelated words predicts creativity" — validated mean pairwise semantic distance as creativity measure
- DAT correlates r=0.40 with composite creativity score across multiple established measures
- Original paper: https://www.pnas.org/doi/10.1073/pnas.2022340118

---

## Combined Scoring Functions

```python
import numpy as np


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two vectors."""
    a = np.array(a)
    b = np.array(b)
    
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    
    if norm_a == 0 or norm_b == 0:
        return 0.0
    
    return float(dot / (norm_a * norm_b))


def calculate_divergence(
    clue_embeddings: list[list[float]],
    prompt_embeddings: list[list[float]]
) -> float:
    """
    Mean pairwise cosine distance between all words (clues + prompt).
    Works for both INS-001.1 and INS-001.2.
    
    Args:
        clue_embeddings: Embeddings for submitted clues
        prompt_embeddings: Embeddings for prompt words
            - INS-001.1: [seed_embedding]
            - INS-001.2: [anchor_embedding, target_embedding]
    
    Returns: Score 0-100 (DAT convention)
    """
    all_embeddings = prompt_embeddings + clue_embeddings
    
    if len(all_embeddings) < 2:
        return 0.0
    
    distances = []
    n = len(all_embeddings)
    
    for i in range(n):
        for j in range(i + 1, n):
            sim = cosine_similarity(all_embeddings[i], all_embeddings[j])
            distance = 1 - sim
            distances.append(distance)
    
    return float(np.mean(distances) * 100)


def score_radiation(
    clue_embeddings: list[list[float]],
    seed_embedding: list[float]
) -> dict:
    """
    Score a participant's semantic radiation submission (INS-001.1).
    
    Args:
        clue_embeddings: List of embedding vectors for submitted clues
        seed_embedding: Embedding vector for seed concept
        
    Returns:
        Dictionary with:
        - relevance: Overall relevance score (mean similarity to seed)
        - relevance_individual: Per-clue relevance scores
        - divergence: Overall divergence (0-100, DAT-style, includes seed)
        - valid: Whether submission passes relevance threshold
    """
    if not clue_embeddings:
        return {
            "relevance": 0.0,
            "relevance_individual": [],
            "divergence": 0.0,
            "valid": False
        }
    
    # Relevance: similarity to seed
    relevance_scores = [
        cosine_similarity(clue, seed_embedding)
        for clue in clue_embeddings
    ]
    
    overall_relevance = float(np.mean(relevance_scores))
    overall_divergence = calculate_divergence(clue_embeddings, [seed_embedding])
    
    RELEVANCE_THRESHOLD = 0.15
    valid = overall_relevance >= RELEVANCE_THRESHOLD
    
    return {
        "relevance": overall_relevance,
        "relevance_individual": relevance_scores,
        "divergence": overall_divergence,
        "valid": valid
    }


def score_union(
    clue_embeddings: list[list[float]],
    anchor_embedding: list[float],
    target_embedding: list[float]
) -> dict:
    """
    Score a participant's semantic union submission (INS-001.2).
    
    Args:
        clue_embeddings: List of embedding vectors for submitted clues
        anchor_embedding: Embedding vector for anchor concept
        target_embedding: Embedding vector for target concept
        
    Returns:
        Dictionary with:
        - relevance: Overall relevance score (mean of mean(sim_a, sim_t))
        - relevance_individual: Per-clue relevance scores
        - divergence: Overall divergence (0-100, DAT-style, includes anchor+target)
        - valid: Whether submission passes relevance threshold
    """
    if not clue_embeddings:
        return {
            "relevance": 0.0,
            "relevance_individual": [],
            "divergence": 0.0,
            "valid": False
        }
    
    # Relevance: mean similarity to both endpoints
    relevance_scores = []
    for clue in clue_embeddings:
        sim_a = cosine_similarity(clue, anchor_embedding)
        sim_t = cosine_similarity(clue, target_embedding)
        relevance_scores.append((sim_a + sim_t) / 2)
    
    overall_relevance = float(np.mean(relevance_scores))
    overall_divergence = calculate_divergence(
        clue_embeddings, 
        [anchor_embedding, target_embedding]
    )
    
    RELEVANCE_THRESHOLD = 0.15
    valid = overall_relevance >= RELEVANCE_THRESHOLD
    
    return {
        "relevance": overall_relevance,
        "relevance_individual": relevance_scores,
        "divergence": overall_divergence,
        "valid": valid
    }
```

---

## Score Normalization

Raw relevance (0-1) and divergence (0-90°) are difficult to interpret without context. Different anchor-target pairs have different baseline geometries—some pairs are naturally closer in embedding space, making high relevance easier to achieve.

**Solution:** Bootstrap null distributions by sampling random word sets from vocabulary. This gives pair-specific baselines.

### Building Null Distributions

```python
def bootstrap_null_distribution(
    prompt_embeddings: dict,
    vocabulary_embeddings: list[list[float]],
    n_clues: int,
    instrument: str,
    n_samples: int = 1000,
    seed: int = 42
) -> dict:
    """
    Build null distributions for relevance and divergence by sampling
    random word sets from vocabulary.
    
    Args:
        prompt_embeddings: For INS-001.1: {"seed": embedding}
                          For INS-001.2: {"anchor": embedding, "target": embedding}
        vocabulary_embeddings: List of embeddings for vocabulary words
        n_clues: Number of clues to sample (match participant's submission size)
        instrument: "radiation" (INS-001.1) or "union" (INS-001.2)
        n_samples: Number of bootstrap samples
        seed: Random seed for reproducibility
        
    Returns:
        Dictionary with:
        - relevance_mean: Mean relevance under null
        - relevance_std: Std of relevance under null
        - divergence_mean: Mean divergence under null
        - divergence_std: Std of divergence under null
        - relevance_samples: Raw samples (for percentile calculation)
        - divergence_samples: Raw samples
    """
    rng = np.random.default_rng(seed)
    
    relevance_samples = []
    divergence_samples = []
    
    vocab_array = np.array(vocabulary_embeddings)
    n_vocab = len(vocab_array)
    
    for _ in range(n_samples):
        # Sample n random words
        indices = rng.choice(n_vocab, size=n_clues, replace=False)
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
        "divergence_samples": divergence_samples
    }
```

### Normalizing Scores

```python
def normalize_scores(
    participant_scores: dict,
    null_distribution: dict,
    method: str = "percentile"
) -> dict:
    """
    Normalize participant scores against null distribution.
    
    Args:
        participant_scores: Output from score_union()
        null_distribution: Output from bootstrap_null_distribution()
        method: "percentile" (0-100) or "zscore" (standard deviations from mean)
        
    Returns:
        Dictionary with:
        - relevance_normalized: Normalized relevance score
        - divergence_normalized: Normalized divergence score
        - relevance_raw: Original relevance
        - divergence_raw: Original divergence
    """
    rel_raw = participant_scores["relevance"]
    div_raw = participant_scores["divergence"]
    
    if method == "percentile":
        # Percentile rank: what % of null samples is this score greater than?
        rel_norm = float(np.mean([rel_raw > s for s in null_distribution["relevance_samples"]]) * 100)
        div_norm = float(np.mean([div_raw > s for s in null_distribution["divergence_samples"]]) * 100)
        
    elif method == "zscore":
        # Z-score: how many standard deviations from null mean?
        rel_std = null_distribution["relevance_std"]
        div_std = null_distribution["divergence_std"]
        
        # Guard against zero std (degenerate case)
        if rel_std > 0:
            rel_norm = float((rel_raw - null_distribution["relevance_mean"]) / rel_std)
        else:
            rel_norm = 0.0
            
        if div_std > 0:
            div_norm = float((div_raw - null_distribution["divergence_mean"]) / div_std)
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
```

### Interpretation

**Percentile method (recommended for user-facing display):**

| Percentile | Interpretation |
|------------|----------------|
| < 25th | Below average (worse than random) |
| 25th–50th | Low average |
| 50th–75th | Above average |
| 75th–90th | Good (better than most random sets) |
| 90th–99th | Excellent |
| > 99th | Exceptional |

**Z-score method (recommended for statistical analysis):**

| Z-score | Interpretation |
|---------|----------------|
| < 0 | Below null mean |
| 0–1 | Slightly above average |
| 1–2 | Notably above average |
| > 2 | Significantly above average (p < 0.05) |
| > 3 | Highly significant (p < 0.001) |

**Note on divergence interpretation:** Since divergence uses DAT-style scoring (0-100), you can also interpret raw scores directly using DAT norms:
- < 50: Low (possibly misunderstood instructions)
- 50–65: Below average
- 65–80: Average  
- 80–90: Above average
- > 90: High

**Example output:**

```
Participant clues: ["flame", "wish", "surprise"]
Anchor: VOLCANO, Target: BIRTHDAY

Raw scores:
  Relevance: 0.38
  Divergence: 72 (DAT-style, 0-100 scale)

Normalized (percentile):
  Relevance: 89th percentile  → "Much more relevant than random"
  Divergence: 67th percentile → "Moderately more spread than random"
```

### Optimization Considerations

Bootstrapping 1000 samples per anchor-target pair is computationally expensive. Consider:

1. **Precompute** — Generate null distributions for all anchor-target pairs in your stimulus set ahead of time. Store results in database.

2. **Cache** — Cache distributions keyed by `(anchor, target, n_clues)` tuple. TTL based on vocabulary changes.

3. **Global null** — Sample random sets across all pairs rather than per-pair. Less accurate but much cheaper. May be acceptable if pairs have similar baseline geometries.

4. **Parametric approximation** — Fit a distribution to the bootstrap samples and store only the parameters:
   - Relevance: Beta distribution (bounded 0-1)
   - Divergence: Could try truncated normal or von Mises (bounded 0-90)
   - Reduces storage from 2000 floats to 4-6 parameters per pair

5. **Reduce sample size** — 500 or even 200 samples may be sufficient for percentile estimation if resolution isn't critical.

6. **Lazy computation** — Only compute null distribution when participant submits, then cache. Cold start for first participant per pair.

---

## Comparing Sets

To compare a participant's submission against an LLM-generated baseline (or any two sets):

```python
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
    rel_delta = participant_scores["relevance"] - baseline_scores["relevance"]
    div_delta = participant_scores["divergence"] - baseline_scores["divergence"]
    
    # Only compare creativity if both are valid
    both_valid = participant_scores["valid"] and baseline_scores["valid"]
    more_creative = both_valid and div_delta > 0
    
    return {
        "relevance_delta": rel_delta,
        "divergence_delta": div_delta,
        "more_creative": more_creative
    }
```

---

## Metrics to Deprecate

The following metrics from `scoring.py` and `scoring_bridging.py` should be removed or deprecated:

### From `scoring.py`

| Metric | Reason |
|--------|--------|
| `compute_divergence()` | Replaced by DAT-style pairwise distance |
| `compute_convergence()` | Not used; was for single-word reconstruction |
| `compute_semantic_portability()` | Derived metric requiring network/stranger convergence |
| `compute_consistency()` | Cross-game aggregate; compute from raw divergence if needed |
| `compute_llm_alignment()` | Replaced by direct comparison of divergence scores |
| `classify_archetype()` | Dependent on deprecated convergence metrics |
| `FUZZY_EXACT_MATCH_THRESHOLD` | Not needed without reconstruction |

### From `scoring_bridging.py`

| Metric | Reason |
|--------|--------|
| `calculate_divergence()` | Replaced by DAT-style pairwise distance |
| `calculate_binding_strength()` | Superseded by relevance |
| `calculate_bridge_similarity()` | Not needed; compare divergence scores directly |
| `calculate_semantic_distance()` | Trivial transform of cosine similarity |
| `calculate_reconstruction()` | Not used in INS-001 |
| `calculate_statistical_baseline()` | Complex; use simple relevance ranking instead |
| `calculate_joint_distance_score()` | Equidistance is weaker criterion than relevance |
| `calculate_union_quality()` | Replaced by relevance |
| `get_divergence_interpretation()` | Update for DAT scale (0-100) |
| `get_reconstruction_interpretation()` | Deprecated with reconstruction |
| `get_union_quality_interpretation()` | Deprecated with union quality |
| `CALIBRATION_MAX` | Not needed for DAT-style divergence |
| `JOINT_DISTANCE_MAX_DIFF` | Deprecated with joint distance |

### Keep

| Function | Reason |
|----------|--------|
| `cosine_similarity()` | Core building block |
| `find_lexical_union()` | Useful for generating LLM/embedding baseline |
| `_is_morphological_variant()` | Useful for filtering clues |
| `_get_word_stem()` | Useful for filtering clues |

---

## Test Cases

```python
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


def test_divergence_union_hard_pair():
    """Hard pair (distant anchor-target) should contribute to divergence."""
    # Orthogonal anchor and target
    anchor = [1.0, 0.0, 0.0]
    target = [0.0, 1.0, 0.0]
    
    # Single clue at midpoint
    clues = [[0.707, 0.707, 0.0]]
    
    div = calculate_divergence(clues, [anchor, target])
    # A-T distance = 1.0, A-clue ≈ 0.29, T-clue ≈ 0.29
    # Mean of 3 distances → should be moderate
    assert 40 < div < 70, f"Expected moderate divergence for hard pair, got {div}"


def test_divergence_union_easy_pair():
    """Easy pair (close anchor-target) should have lower base divergence."""
    # Similar anchor and target
    anchor = [1.0, 0.0, 0.0]
    target = [0.95, 0.1, 0.0]
    
    # Single clue nearby
    clues = [[0.9, 0.15, 0.0]]
    
    div = calculate_divergence(clues, [anchor, target])
    # All words are close together
    assert div < 30, f"Expected low divergence for easy pair, got {div}"


def test_score_radiation():
    """Integration test for INS-001.1 scoring."""
    seed = [1.0, 0.0, 0.0]
    
    clues = [
        [0.8, 0.2, 0.0],   # Relevant to seed
        [0.7, 0.3, 0.1],   # Relevant to seed, different direction
        [0.6, 0.4, 0.2],   # Relevant to seed, more different
    ]
    
    result = score_radiation(clues, seed)
    
    assert result["valid"] == True
    assert result["relevance"] > 0.5  # Should be relevant to seed
    assert result["divergence"] > 10  # Should have some spread (includes seed)
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
    # Divergence includes anchor-target distance, so should be substantial
    assert result["divergence"] > 40
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
    # Fake participant scores
    participant_scores = {
        "relevance": 0.5,
        "divergence": 85.0
    }
    
    # Fake null distribution where participant is above average
    null_dist = {
        "relevance_samples": [0.1, 0.2, 0.3, 0.4, 0.45] * 20,  # 100 samples, mostly below 0.5
        "divergence_samples": [60, 65, 70, 75, 80] * 20,  # 100 samples, mostly below 85
        "relevance_mean": 0.29,
        "relevance_std": 0.13,
        "divergence_mean": 70.0,
        "divergence_std": 7.5
    }
    
    result = normalize_scores(participant_scores, null_dist, method="percentile")
    
    assert result["relevance_normalized"] > 80  # Should be high percentile
    assert result["divergence_normalized"] > 80  # Should be high percentile
    assert result["relevance_raw"] == 0.5
    assert result["divergence_raw"] == 85.0


def test_normalize_scores_zscore():
    """Test z-score normalization."""
    participant_scores = {
        "relevance": 0.5,
        "divergence": 85.0
    }
    
    null_dist = {
        "relevance_samples": [],  # Not used for z-score
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


if __name__ == "__main__":
    test_cosine_similarity()
    test_relevance_radiation()
    test_relevance_union()
    test_divergence_identical_clues()
    test_divergence_orthogonal_clues()
    test_divergence_similar_clues_near_seed()
    test_divergence_union_hard_pair()
    test_divergence_union_easy_pair()
    test_score_radiation()
    test_score_union()
    test_bootstrap_null_distribution()
    test_normalize_scores_percentile()
    test_normalize_scores_zscore()
    print("All tests passed!")
```
