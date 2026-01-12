"""
LLM Guesser Service - INS-001 Semantic Associations

Uses Claude 3.5 Haiku to guess the seed word from clues.
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


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_llm_guess())
