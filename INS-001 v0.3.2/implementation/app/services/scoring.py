"""
Scoring Algorithms - INS-001 Semantic Associations

These are the EXACT algorithms. Do not modify the math.
Test cases at bottom verify correctness.
"""

import numpy as np
from typing import Optional


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


# Fuzzy matching threshold for misspellings and alternate spellings
# If embedding similarity > 99%, treat as exact match
FUZZY_EXACT_MATCH_THRESHOLD = 0.99


def compute_divergence(
    clue_embeddings: list[list[float]],
    floor_embeddings: list[list[float]]
) -> float:
    """
    Compute divergence score for a set of clues.
    
    Divergence = how far clues are from the noise floor (predictable associations).
    Higher = more creative/unexpected associations.
    
    Algorithm:
    1. Compute centroid of noise floor embeddings
    2. For each clue, compute similarity to centroid
    3. Divergence = 1 - mean(similarities)
    
    Args:
        clue_embeddings: List of embedding vectors for each clue
        floor_embeddings: List of embedding vectors for noise floor words
        
    Returns:
        Divergence score in range [0, 1]
        - 0.0-0.3: Low divergence (conventional)
        - 0.3-0.6: Moderate divergence
        - 0.6-1.0: High divergence (creative)
    """
    if not clue_embeddings or not floor_embeddings:
        return 0.0
    
    # Compute floor centroid (mean of all floor vectors)
    floor_matrix = np.array(floor_embeddings)
    floor_centroid = np.mean(floor_matrix, axis=0)
    
    # Compute similarity of each clue to the centroid
    similarities = []
    for clue_emb in clue_embeddings:
        sim = cosine_similarity(clue_emb, floor_centroid.tolist())
        similarities.append(sim)
    
    # Divergence = 1 - mean similarity
    # High similarity to floor = low divergence (conventional)
    # Low similarity to floor = high divergence (creative)
    mean_similarity = np.mean(similarities)
    divergence = 1.0 - mean_similarity
    
    # Clamp to [0, 1] (similarities can be negative for opposite directions)
    return float(max(0.0, min(1.0, divergence)))


def compute_convergence(
    seed_embedding: list[float],
    guess_embeddings: list[list[float]],
    seed_word: str,
    guesses: list[str]
) -> tuple[float, bool]:
    """
    Compute convergence score for a set of guesses.
    
    Handles the case where seed might be misspelled or use alternate
    spelling (e.g., "Ghandi" vs "Gandhi") by treating very high
    similarity (>99%) as an exact match.
    
    Args:
        seed_embedding: Embedding vector for the seed word
        guess_embeddings: List of embedding vectors for each guess
        seed_word: The actual seed word (for exact match check)
        guesses: The actual guess words (for exact match check)
        
    Returns:
        Tuple of (convergence_score, exact_match)
        - convergence_score in range [0, 1]
        - exact_match: True if any guess exactly matches seed (string or fuzzy)
        
    Interpretation:
        - 0.0-0.4: Low convergence (communication failure)
        - 0.4-0.7: Partial convergence (semantic neighborhood)
        - 0.7-1.0: High convergence (successful communication)
    """
    # 1. Check string exact match (case-insensitive)
    seed_lower = seed_word.lower().strip()
    for guess in guesses:
        if guess.lower().strip() == seed_lower:
            return 1.0, True
    
    if not guess_embeddings:
        return 0.0, False
    
    # 2. Compute similarity of each guess to seed
    similarities = []
    for guess_emb in guess_embeddings:
        sim = cosine_similarity(guess_emb, seed_embedding)
        similarities.append(sim)
    
    max_similarity = max(similarities)
    
    # 3. Fuzzy exact match bonus
    # Handles misspellings and alternate spellings (Ghandi/Gandhi)
    # If embedding similarity is >99%, treat as exact match
    if max_similarity > FUZZY_EXACT_MATCH_THRESHOLD:
        return 1.0, True
    
    # 4. Return best similarity, clamped to [0, 1]
    return float(max(0.0, min(1.0, max_similarity))), False


def compute_semantic_portability(
    network_convergence: Optional[float],
    stranger_convergence: Optional[float]
) -> Optional[float]:
    """
    Compute semantic portability: how well associations travel outside your context.
    
    Formula: stranger_convergence / network_convergence
    
    Interpretation:
    - > 1.0: Better with strangers (universally accessible)
    - = 1.0: Same with both
    - < 1.0: Better with network (context-dependent)
    """
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
    Compute consistency: reliability of divergence pattern across games.
    
    Formula: 1 - (std / mean) = 1 - coefficient of variation
    
    Interpretation:
    - Close to 1.0: Very consistent pattern
    - Close to 0.0: Highly variable
    """
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
    Compute LLM alignment: whether you think like the "statistical average".
    
    Formula: llm_convergence / stranger_convergence
    
    Interpretation:
    - > 1.0: LLM guesses better than strangers (conventional thinking)
    - = 1.0: Same
    - < 1.0: Strangers guess better (idiosyncratic thinking)
    """
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
    Classify cognitive archetype based on scores.
    
    Returns one of:
    - "Creative Communicator": High divergence, high convergence across all
    - "In-Group Creator": High divergence, high network, low stranger/llm
    - "Idiosyncratic": High divergence, low convergence across all
    - "Conventional Coordinator": Low divergence, high convergence
    - "Communication Difficulty": Low divergence, low convergence
    """
    high_div = divergence > 0.5
    high_network = network_conv > 0.6
    high_stranger = stranger_conv > 0.6
    moderate_llm = llm_conv > 0.4
    
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


def test_divergence():
    """Test divergence calculation."""
    # Clues identical to floor → divergence = 0
    floor = [[1, 0, 0], [0.9, 0.1, 0], [0.8, 0.2, 0]]
    clues = [[0.9, 0.1, 0]]  # Very similar to floor
    div = compute_divergence(clues, floor)
    assert div < 0.3, f"Expected low divergence, got {div}"
    
    # Clues orthogonal to floor → divergence ≈ 1
    floor = [[1, 0, 0], [0.9, 0.1, 0], [0.8, 0.2, 0]]
    clues = [[0, 1, 0], [0, 0, 1]]  # Orthogonal
    div = compute_divergence(clues, floor)
    assert div > 0.7, f"Expected high divergence, got {div}"


def test_convergence():
    """Test convergence calculation."""
    # Exact string match
    seed_emb = [1, 0, 0]
    guess_embs = [[0, 1, 0]]
    conv, exact = compute_convergence(seed_emb, guess_embs, "cat", ["cat"])
    assert exact == True
    assert conv == 1.0
    
    # Similar guess (not exact)
    seed_emb = [1, 0, 0]
    guess_embs = [[0.9, 0.1, 0]]
    conv, exact = compute_convergence(seed_emb, guess_embs, "cat", ["dog"])
    assert exact == False
    assert conv > 0.8


def test_fuzzy_exact_match():
    """Test that very high similarity counts as exact match."""
    # Simulate nearly identical embeddings (>99% similar)
    # This handles misspellings like Ghandi/Gandhi
    seed_emb = [1.0, 0.0, 0.0]
    guess_embs = [[0.9999, 0.001, 0.0]]  # >99% similar
    
    conv, exact = compute_convergence(seed_emb, guess_embs, "ghandi", ["gandhi"])
    assert exact == True, "Fuzzy match should trigger for >99% similarity"
    assert conv == 1.0


def test_string_exact_match_case_insensitive():
    """Test that exact string match is case-insensitive."""
    seed_emb = [1, 0, 0]
    guess_embs = [[0, 1, 0]]  # Embedding doesn't matter - string match first
    
    conv, exact = compute_convergence(seed_emb, guess_embs, "Coffee", ["COFFEE"])
    assert exact == True
    assert conv == 1.0


def test_no_fuzzy_match_below_threshold():
    """Test that similarity below threshold doesn't trigger fuzzy match."""
    seed_emb = [1.0, 0.0, 0.0]
    guess_embs = [[0.95, 0.1, 0.0]]  # ~95% similar, below 99% threshold
    
    conv, exact = compute_convergence(seed_emb, guess_embs, "cat", ["dog"])
    assert exact == False, "Should not trigger fuzzy match below threshold"
    assert conv < 1.0


def test_archetypes():
    """Test archetype classification."""
    assert classify_archetype(0.7, 0.8, 0.7, 0.5) == "Creative Communicator"
    assert classify_archetype(0.7, 0.8, 0.3, 0.2) == "In-Group Creator"
    assert classify_archetype(0.7, 0.3, 0.3, 0.2) == "Idiosyncratic"
    assert classify_archetype(0.3, 0.8, 0.8, 0.8) == "Conventional Coordinator"


if __name__ == "__main__":
    test_cosine_similarity()
    test_divergence()
    test_convergence()
    test_archetypes()
    print("All tests passed!")
