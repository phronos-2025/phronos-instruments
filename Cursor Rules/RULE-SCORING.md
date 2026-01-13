---
description: "LOCKED - Scoring algorithms define construct validity. DO NOT MODIFY without explicit approval."
globs: ["**/scoring.py", "scoring.py"]
alwaysApply: false
---

# ⛔ SCORING.PY IS LOCKED

## DO NOT MODIFY without explicit user approval

The scoring formulas define construct validity for the cognitive assessment.
Changing them invalidates all collected data.

## Locked Formulas

```python
# Divergence - DO NOT CHANGE
divergence = 1 - mean(cosine_similarity(clue_embeddings, floor_centroid))

# Convergence - DO NOT CHANGE  
convergence = mean(cosine_similarity(guess_embeddings, seed_embedding))

# Fuzzy match threshold - DO NOT CHANGE
FUZZY_EXACT_MATCH_THRESHOLD = 0.99
```

## Locked Constants

- Range: [0, 1] for both metrics
- Fuzzy match (>99% similarity) returns 1.0

## If You Think Changes Are Needed

1. STOP - Do not modify
2. Explain the proposed change to the user
3. Show the scientific/validity impact
4. Get explicit written approval
5. Document the change in DECISION-HISTORY.md

## Tests Must Pass

Before any change is even considered:
```bash
python -m pytest scoring.py -v
```

All existing tests MUST continue to pass.
