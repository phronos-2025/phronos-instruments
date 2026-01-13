"""
LLM Guesser Service - INS-001 Semantic Associations

Uses Claude 3.5 Haiku to guess:
- INS-001: The seed word from clues
- INS-001.2: The anchor-target pair from bridge clues
"""

import os
import html
from anthropic import AsyncAnthropic

# ============================================
# CONFIGURATION
# ============================================

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

# Use Haiku 4.5 for speed and cost
# DO NOT change model without updating construct validity analysis
# LLM Alignment metric depends on consistent model behavior
MODEL = "claude-haiku-4-5-20251001"

# Initialize client
anthropic_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)


# ============================================
# GUESSING
# ============================================

async def llm_guess(clues: list[str], num_guesses: int = 3) -> list[str]:
    """
    Have Claude guess the target word from clues.
    
    Args:
        clues: List of clue words (already validated against vocabulary)
        num_guesses: Number of guesses to return (default 3)
        
    Returns:
        List of guess words (may be fewer than num_guesses if parsing fails)
    """
    # Build prompt with XML-escaped clues for safety
    # Even though clues are validated, defense in depth
    escaped_clues = [html.escape(c) for c in clues]
    clue_xml = "\n".join(f"  <clue>{c}</clue>" for c in escaped_clues)
    
    prompt = f"""You are playing a word-guessing game. Someone is trying to communicate a target word to you using clues.

<clues>
{clue_xml}
</clues>

Based on these clues, what do you think the target word is?

Rules:
- Provide exactly {num_guesses} guesses
- One word per line
- Just the word, no explanation or numbering
- Single words only (no phrases)

Your guesses:"""

    response = await anthropic_client.messages.create(
        model=MODEL,
        max_tokens=100,
        messages=[{"role": "user", "content": prompt}]
    )
    
    # Parse response
    text = response.content[0].text.strip()
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # Clean up guesses (remove numbering, punctuation, etc.)
    guesses = []
    for line in lines:
        # Remove common prefixes like "1.", "1)", "-", etc.
        cleaned = line.lstrip('0123456789.-) ')
        # Take first word only
        word = cleaned.split()[0] if cleaned.split() else ""
        # Remove any remaining punctuation
        word = ''.join(c for c in word if c.isalpha())
        if word:
            guesses.append(word.lower())
    
    return guesses[:num_guesses]


# ============================================
# INS-001.2: BRIDGE RECONSTRUCTION
# ============================================

async def haiku_reconstruct_bridge(clues: list[str]) -> dict:
    """
    Have Claude Haiku guess the anchor-target pair from bridge clues.

    This is a generative baseline - Haiku reasons about the clues
    to infer what two concepts were being connected.

    Args:
        clues: List of 1-5 clue words that connect anchor and target

    Returns:
        Dictionary with:
        - guessed_anchor: First word guess
        - guessed_target: Second word guess
        - raw_response: Original response text
        - error: Error message if parsing failed
    """
    # Build prompt with XML-escaped clues
    escaped_clues = [html.escape(c) for c in clues]
    clue_xml = "\n".join(f"  <clue>{c}</clue>" for c in escaped_clues)

    prompt = f"""You are playing a word game. Someone chose two words (an anchor and a target) and provided clues that connect them.

<clues>
{clue_xml}
</clues>

These clues are meant to form a bridge between two concepts. What two words do you think were being connected?

Rules:
- Respond with exactly two words separated by a comma
- First word is your guess for the anchor, second for the target
- Single words only (no phrases)
- Just the words, no explanation

Your guess:"""

    response = await anthropic_client.messages.create(
        model=MODEL,
        max_tokens=50,
        messages=[{"role": "user", "content": prompt}]
    )

    # Parse response
    text = response.content[0].text.strip()

    # Try to extract two words
    # Handle formats: "word1, word2" or "word1,word2" or "word1 word2"
    parts = []
    if ',' in text:
        parts = [p.strip().lower() for p in text.split(',')]
    else:
        parts = text.lower().split()

    # Clean each part (remove punctuation, take first word)
    cleaned_parts = []
    for part in parts:
        word = ''.join(c for c in part if c.isalpha())
        if word:
            cleaned_parts.append(word)

    if len(cleaned_parts) >= 2:
        return {
            "guessed_anchor": cleaned_parts[0],
            "guessed_target": cleaned_parts[1],
            "raw_response": text
        }

    return {
        "guessed_anchor": None,
        "guessed_target": None,
        "raw_response": text,
        "error": "Could not parse response into two words"
    }


# ============================================
# TESTING
# ============================================

async def test_llm_guess():
    """Test the LLM guesser with known clues."""
    # These clues should make "coffee" fairly guessable
    clues = ["morning", "caffeine", "bean", "cup", "brew"]
    guesses = await llm_guess(clues, num_guesses=3)
    
    print(f"Clues: {clues}")
    print(f"Guesses: {guesses}")
    
    # Coffee should be in the guesses
    assert any("coffee" in g.lower() for g in guesses), f"Expected 'coffee' in guesses: {guesses}"
    print("Test passed!")


async def test_haiku_reconstruct_bridge():
    """Test the bridge reconstruction with known clues."""
    # Clues bridging "coffee" and "morning"
    clues = ["wake", "cup", "routine", "breakfast", "energy"]
    result = await haiku_reconstruct_bridge(clues)

    print(f"Clues: {clues}")
    print(f"Result: {result}")

    assert result.get("guessed_anchor") is not None, "Should have guessed anchor"
    assert result.get("guessed_target") is not None, "Should have guessed target"
    print("Bridge reconstruction test passed!")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_llm_guess())
    asyncio.run(test_haiku_reconstruct_bridge())
