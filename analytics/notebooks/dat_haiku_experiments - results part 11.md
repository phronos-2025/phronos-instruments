## Part 11: DAT Calibration for INS-001.2 Divergence Scores

### Purpose
Map INS-001.2 divergence scores onto the interpretable DAT scale using Claude Haiku as a calibration reference.

### Method
1. Run Haiku through standard DAT (7 words, 21 pairs)
2. Run Haiku through INS-001.2 bridging (12 words: anchor + target + 10 clues, 66 pairs)
3. Compute task structure adjustment: delta = DAT_score - INS001.2_score
4. Apply adjustment to interpret human INS-001.2 scores on DAT scale

### Key Assumption
Haiku's semantic divergence capacity is constant across tasks. Score differences reflect task structure (word count, constraint type), not ability differences.

### Task Structure Comparison

| Task | Total Words | Participant Words | Pairs |
|------|-------------|-------------------|-------|
| DAT (Olson) | 7 | 7 | 21 |
| INS-001.2 | 12 (anchor + target + 10 clues) | 10 | 66 |

The 66 pairs in INS-001.2 decompose as:
- 1 pair: anchor-target (fixed by task design)
- 20 pairs: clue-anchor, clue-target (relevance-constrained)
- 45 pairs: clue-clue (participant's divergent capacity)

Note: 10 clues provides 4,500 clue-clue pairs across 100 trials for robust analysis.

### Reference Norms (Olson et al. 2021)
- Human DAT mean: 78 (SD: 6)
- Interpretation: <50 poor, 65-80 average, >90 high

DAT and Bridging scorer functions defined:
  - score_dat_pure(embeddings): Pure 7-word DAT score (21 pairs)
  - score_bridging_full(anchor, target, clues): Full 7-word INS-001.2 score (21 pairs)
  - score_bridging_clues_only(clues): 5-clue only score (10 pairs)

=== Re-scoring for Calibration ===

DAT trials re-scored: 150
  Mean (pure DAT, OpenAI): 74.10
  SD: 1.56
  Range: 70.87 - 78.98

Bridging trials re-scored: 116
  Full (12 words, 66 pairs):
    Mean: 66.12, SD: 4.14
  Clue-only (10 clues, 45 pairs):
    Mean: 65.38, SD: 4.53

=== Divergence Decomposition ===

INS-001.2 Divergence Decomposition (N=116):

  Component Distances (raw 0-1 scale):
    Anchor-target (1 pair): mean=0.7537, sd=0.0537
    Clue-prompt (20 pairs): mean=0.6730, sd=0.0414
    Clue-clue (45 pairs):   mean=0.6538, sd=0.0453

  Divergence Scores (DAT-style x100):
    Full (12 words, 66 pairs): mean=66.12, sd=4.14
    Clue-only (10 clues, 45 pairs): mean=65.38, sd=4.53

  Note: Clue-clue divergence is most comparable to DAT since both
  measure spread among participant-generated words only.

=== Calibration Analysis ===

Haiku Reference Scores:
  DAT (7 words, 21 pairs):                   mean=74.10, sd=1.56
  INS-001.2 full (12 words, 66 pairs):    mean=66.12, sd=4.14
  INS-001.2 clue-only (10 clues, 45 pairs): mean=65.38, sd=4.53

Calibration Adjustment Factors:
  Full adjustment:      +7.98 points
  Clue-clue adjustment: +8.72 points

Recommended Calibration:
  Use full adjustment (+7.98) for raw INS-001.2 divergence scores
  Example: INS-001.2 score of 70 -> DAT-equivalent of 78

Human Norms Mapping:
  Human DAT mean (78) -> INS-001.2 equivalent: 70
  Human DAT low (72)  -> INS-001.2 equivalent: 64
  Human DAT high (84) -> INS-001.2 equivalent: 76

=== Assumption Validation ===

Testing: Is Haiku's pairwise divergence consistent across tasks?

Pairwise Distances Collected:
  DAT word pairs: n=3150, mean=0.7410, sd=0.0614
  Bridging clue pairs: n=5202, mean=0.6539, sd=0.1042

Independent t-test:
  t = 42.622
  p = 0.0000
  Cohen's d = 1.018

Interpretation:
  [WARNING] Significant difference detected (p=0.0000)
  DAT pairwise distances are higher than bridging clue distances.
  Effect size: 1.02 (large)
  Consider task-specific calibration adjustments.

Calibration parameters saved to data/dat_calibration_params.json

============================================================
CALIBRATION COMPLETE
============================================================

Calibration adjustment: +7.98 points
Assumption validated: False

Example conversions:
  INS-001.2: 60 -> DAT: 68 (Low Average)
  INS-001.2: 70 -> DAT: 78 (Average (human norm range))
  INS-001.2: 80 -> DAT: 88 (Above Average)
  INS-001.2: 90 -> DAT: 98 (High)

Functions available:
  - dat_equivalent_score(divergence): Convert to DAT scale
  - get_divergence_interpretation_calibrated(divergence): Get interpretation