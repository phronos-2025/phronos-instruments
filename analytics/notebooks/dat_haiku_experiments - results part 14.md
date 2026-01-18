## Part 14: Relevance Metric Characterization

### Overview
Characterize the relevance metric behavior using Haiku as the reference for "optimal bridging."

**Relevance Formula** (from `scoring.py`):
```python
for clue in clue_embeddings:
    sim_a = cosine_similarity(clue, anchor_embedding)
    sim_t = cosine_similarity(clue, target_embedding)
    relevance_scores.append(min(sim_a, sim_t))  # Must bridge BOTH

overall_relevance = mean(relevance_scores)
```

### Current Interpretation Thresholds
- < 0.15 — Noise/unrelated
- 0.15–0.30 — Weak (tangential)
- 0.30–0.45 — Moderate (connected)
- > 0.45 — Strong (core neighborhood)

### Analysis Goals
1. **Haiku baseline** — Establish reference distribution
2. **Clue count trajectory** — Does relevance degrade with more clues?
3. **Clue position effects** — Are later clues less relevant?
4. **Pair difficulty moderation** — Does A-T distance affect achievable relevance?
5. **Relevance-divergence tradeoff** — Quantify the fundamental tension
6. **Threshold validation** — Are current thresholds appropriate?

=== Haiku Relevance Baseline ===

Reference clue count: 4

============================================================
HAIKU RELEVANCE BASELINE (4 clues)
============================================================
  Mean:   0.2761
  SD:     0.0481
  Median: 0.2645
  Range:  0.1567 - 0.3836

Percentile Distribution:
   5th percentile: 0.2128
  10th percentile: 0.2258
  25th percentile: 0.2487
  50th percentile: 0.2645
  75th percentile: 0.3108
  90th percentile: 0.3330
  95th percentile: 0.3669

Current Threshold Assessment:
  Noise (<0.15):        0 trials (  0.0%)
  Weak (0.15-0.30):    79 trials ( 69.3%)
  Moderate (0.30-0.45):  35 trials ( 30.7%)
  Strong (>0.45):       0 trials (  0.0%)

Note: Haiku mean is in 'Weak' range - current thresholds may be too strict.

=== Relevance vs Clue Count Trajectory ===

Relevance by Clue Count
================================================================================
  N       Mean         SD        Min        Max     Trials
--------------------------------------------------------------------------------
  1     0.2758     0.0665     0.1474     0.4312        114
  2     0.2807     0.0527     0.1608     0.4127        114
  3     0.2773     0.0482     0.1609     0.3962        114
  4     0.2761     0.0481     0.1567     0.3836        114
  5     0.2744     0.0457     0.1625     0.3796        114
  6     0.2735     0.0437     0.1673     0.3668        114
  7     0.2724     0.0423     0.1669     0.3649        114
  8     0.2730     0.0417     0.1727     0.3589        114
  9     0.2718     0.0402     0.1799     0.3544        114
 10     0.2701     0.0400     0.1761     0.3538        114

Linear trend: slope = -0.000892 per clue
              r = -0.0540, p = 0.0681
  ✓ No significant trend: relevance stable across clue counts

  === Clue Position Effects ===

Relevance by Clue Position
=====================================================================================
 Pos  Relevance       SD     Sim(A)     Sim(T)    Balance        N
-------------------------------------------------------------------------------------
   1     0.2758   0.0665     0.3643     0.3338     0.6849      114
   2     0.2855   0.0543     0.3193     0.3487     0.7613      114
   3     0.2707   0.0557     0.3170     0.3360     0.7324      114
   4     0.2722   0.0627     0.3203     0.3205     0.7572      114
   5     0.2677   0.0592     0.3135     0.3210     0.7478      114
   6     0.2693   0.0642     0.3069     0.3696     0.6912      114
   7     0.2656   0.0554     0.3016     0.3296     0.7442      114
   8     0.2769   0.0633     0.3111     0.3567     0.7248      114
   9     0.2622   0.0545     0.3085     0.3248     0.7259      114
  10     0.2556   0.0657     0.2984     0.3309     0.7037      114

Position effect: -0.00202 per position
                 r = -0.0956, p = 0.0012
ANOVA: F = 2.16, p = 0.0224
  ⚠ Significant position effect detected
  Clue 1 vs Clue 10: t = 2.31, p = 0.0216
  Clue 1 mean: 0.2758
  Clue 10 mean: 0.2556
  Difference: 0.0203

  === Pair Difficulty Effect on Relevance ===

Correlation (A-T distance vs relevance): r = -0.4055, p = 0.0000
  ⚠ Confirmed: Harder pairs have LOWER relevance
    The bridging region shrinks as endpoints diverge.

Relevance by Pair Difficulty Tercile:
------------------------------------------------------------
      Easy: relevance = 0.2900 (SD=0.0417), A-T dist = 0.696, n=38
    Medium: relevance = 0.2922 (SD=0.0473), A-T dist = 0.756, n=39
      Hard: relevance = 0.2447 (SD=0.0404), A-T dist = 0.814, n=37

ANOVA: F = 14.39, p = 0.0000
  ⚠ Significant difference across difficulty terciles
  Easy vs Hard difference: 0.0453

  === Relevance-Divergence Tradeoff ===

Trial-Level Correlation (Relevance vs Clue-Only Divergence)
  r = -0.6085, p = 0.0000

  ⚠ Strong tradeoff detected
    Higher relevance → Lower divergence
    Participants must balance these competing objectives.

Clue-Level Correlation (Relevance vs Clue-Prompt Distance)
  r = -0.7436, p = 0.0000
  (Negative r means: more relevant clues are closer to prompts, as expected)

  Figure: Relevance-Divergence Tradeoff.png

  === Threshold Validation ===

Current Thresholds vs Haiku Distribution:
------------------------------------------------------------
    Category           Range    Count    Percent
------------------------------------------------------------
       Noise       0.00-0.15        0       0.0%
        Weak       0.15-0.30       79      69.3%
    Moderate       0.30-0.45       35      30.7%
      Strong       0.45-1.00        0       0.0%

Haiku-Based Threshold Proposal:
------------------------------------------------------------
If Haiku represents 'optimal bridging', human scores can be interpreted as:

             Poor (< Haiku 10th): 0.0000 - 0.2258
         Below Average (10-25th): 0.2258 - 0.2487
               Average (25-75th): 0.2487 - 0.3108
         Above Average (75-90th): 0.3108 - 0.3330
              Excellent (> 90th): 0.3330 - 1.0000

Comparison:
------------------------------------------------------------
  Current 'Noise' threshold:    < 0.15
  Haiku 10th percentile:        0.2258
  Recommendation: Revise noise threshold

  Current 'Moderate' threshold: 0.30
  Haiku 50th percentile:        0.2645
  Recommendation: Aligned

  Current 'Strong' threshold:   0.45
  Haiku 90th percentile:        0.3330
  Recommendation: Consider revision

============================================================
RECOMMENDATION:
  Current thresholds may be TOO STRICT.
  Haiku (optimal bridger) averages in 'Weak' range.
  Consider lowering thresholds or using percentile-based interpretation.


Figure: relevance_characterization.png

======================================================================
RELEVANCE METRIC CHARACTERIZATION: SUMMARY
======================================================================

1. HAIKU BASELINE (4 clues)
----------------------------------------
   Mean relevance: 0.2761
   SD: 0.0481
   Median: 0.2645
   Range: 0.1567 - 0.3836

2. CLUE COUNT TRAJECTORY
----------------------------------------
   No significant trend (p=0.0681)
   Relevance stable across clue counts

3. CLUE POSITION EFFECTS
----------------------------------------
   Significant position effect (F=2.16, p=0.0224)
   Clue 1 mean: 0.2758
   Clue 10 mean: 0.2556

4. PAIR DIFFICULTY EFFECT
----------------------------------------
   A-T distance vs relevance: r=-0.4055, p=0.0000
   ⚠ Harder pairs → Lower achievable relevance

5. RELEVANCE-DIVERGENCE TRADEOFF
----------------------------------------
   Trial-level correlation: r=-0.6085
   ⚠ Tradeoff exists: participants must balance relevance vs divergence

6. THRESHOLD RECOMMENDATIONS
----------------------------------------
   Haiku 10th percentile: 0.2258 (proposed 'Poor' threshold)
   Haiku 50th percentile: 0.2645 (proposed 'Average' midpoint)
   Haiku 90th percentile: 0.3330 (proposed 'Excellent' threshold)

7. EXPORT
----------------------------------------
   Parameters saved to: data/relevance_characterization_params.json

======================================================================
RELEVANCE CHARACTERIZATION COMPLETE
======================================================================