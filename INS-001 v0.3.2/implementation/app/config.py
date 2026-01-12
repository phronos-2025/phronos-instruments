"""
Application Configuration - INS-001 Semantic Associations

Loads environment variables and static configuration.
"""

import os
from pathlib import Path

# ============================================
# ENVIRONMENT
# ============================================

APP_ENV = os.environ.get("APP_ENV", "development")
APP_URL = os.environ.get("APP_URL", "http://localhost:8000")

# Supabase
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")  # Optional, for background jobs only

# OpenAI
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]

# Anthropic
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

# Analytics (optional)
POSTHOG_API_KEY = os.environ.get("POSTHOG_API_KEY")
SENTRY_DSN = os.environ.get("SENTRY_DSN")


# ============================================
# BLOCKLIST (commented out for MVP)
# ============================================
# 
# Blocklist adds complexity without clear benefit for MVP:
# - Seed word never enters LLM prompt (no injection risk)
# - Only visible to two consenting players in private game
# - No legal requirement (Section 230 protects platforms)
# 
# Uncomment if: app store distribution, or abuse patterns emerge
#
# def _load_blocklist() -> set[str]:
#     """Load offensive word blocklist."""
#     possible_paths = [
#         Path(__file__).parent.parent / "scripts" / "data" / "blocklist.txt",
#         Path(__file__).parent.parent / "data" / "blocklist.txt",
#         Path("/app/data/blocklist.txt"),
#     ]
#     
#     for blocklist_path in possible_paths:
#         if blocklist_path.exists():
#             with open(blocklist_path) as f:
#                 blocklist = {line.strip().lower() for line in f if line.strip()}
#             print(f"Loaded blocklist with {len(blocklist)} words from {blocklist_path}")
#             return blocklist
#     
#     print("WARNING: Blocklist not found.")
#     return set()
#
# BLOCKLIST: set[str] = _load_blocklist()


def is_blocked_word(word: str) -> bool:
    """
    Check if word is blocked.
    
    MVP: Always returns False (no blocklist).
    Uncomment blocklist loading above to enable.
    """
    # return word.lower().strip() in BLOCKLIST
    return False


# ============================================
# GAME SETTINGS
# ============================================

# Number of clues sender must provide
NUM_CLUES = 5

# Number of guesses recipient can make
NUM_GUESSES = 3

# Number of words in noise floor
NOISE_FLOOR_K = 20

# LLM settings
LLM_TEMPERATURE = 0.3

# Fuzzy matching threshold (for misspellings)
FUZZY_EXACT_MATCH_THRESHOLD = 0.99

# Profile computation
PROFILE_THRESHOLD_GAMES = 15  # Games needed before profile is ready
