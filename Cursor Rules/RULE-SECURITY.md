---
description: "Security rules for API route handlers - service key prohibition, validation rules"
globs: ["**/*.py"]
alwaysApply: false
---

# Security Rules for Route Handlers

## 🚨 ABSOLUTE RULE: Never Use Service Key in Routes

```python
# ❌ FORBIDDEN - Bypasses all RLS, causes data breach
from app.config import SUPABASE_SERVICE_KEY
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ✅ REQUIRED - Uses user JWT, RLS enforced
supabase, user = await get_authenticated_client(credentials)
```

The service key is ONLY for background jobs (profile computation, cleanup).
NEVER import or use it in route handlers.

## Word Validation Rules

**Seed words: OPEN (any word allowed)**
```python
# ✅ CORRECT - Accept any seed word
seed_word = request.seed_word.lower().strip()
# Just use it - no vocabulary validation

# ❌ WRONG - Never validate seeds against vocabulary
if not await validate_word(supabase, request.seed_word):
    raise HTTPException(400, "Invalid")  # DON'T DO THIS FOR SEEDS
```

**Clues and guesses: CLOSED (vocabulary only)**
```python
# ✅ REQUIRED - Always validate clues/guesses
all_valid, invalid = await validate_words(supabase, request.clues)
if not all_valid:
    raise HTTPException(400, f"Invalid: {invalid}")
```

Why the difference?
- Seed: Never enters LLM prompt, no injection risk
- Clues: Go to LLM prompt, MUST validate
- Guesses: Need reliable embeddings for scoring

## Error Response Format

```python
# ✅ CORRECT - Dict detail with ErrorResponse shape
raise HTTPException(
    status_code=400,
    detail={"error": "Invalid clues", "detail": "Words not in vocabulary"}
)

# ❌ WRONG - String detail
raise HTTPException(400, "Invalid clues")
```

## Contextual Embeddings for Scoring

```python
# ✅ CORRECT - Include clues as context for disambiguation
seed_emb = await get_contextual_embedding(seed_word, clues)
guess_embs = [await get_contextual_embedding(g, clues) for g in guesses]

# ❌ WRONG for convergence scoring - No context
seed_emb = await get_embedding(seed_word)
```

## Async Consistency

```python
# ✅ CORRECT
async def create_game(...):
    result = await get_embedding(word)

# ❌ WRONG
def create_game(...):  # Should be async
    result = get_embedding(word)  # Missing await
```
