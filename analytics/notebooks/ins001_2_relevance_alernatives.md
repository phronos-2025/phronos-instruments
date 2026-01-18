# INS-001.2 Alternative Relevance Metrics: Experimental Evaluation

This notebook evaluates three alternative relevance metrics for INS-001.2 bridging:
1. **Discriminative Relevance** - Can we distinguish the true pair from foil pairs?
2. **Joint Constraint Score** - How well do clues triangulate the endpoints?
3. **Balance Score** - Are clues balanced between anchor and target?

## Goal
Find a relevance metric that:
- Measures whether clues are "on task" (not gibberish)
- Is independent of divergence (target: |r| < 0.30)
- Has meaningful variance across participants
- Is computationally tractable

## Success Criteria

| Metric | Pass Criterion | Rationale |
|--------|----------------|-----------|
| Divergence correlation | \|r\| < 0.30 | Independence from spread |
| Variance | SD > 0.05 (normalized scale) | Meaningful individual differences |
| Distribution | Not degenerate (>90% at one value) | Discriminates across trials |
| A-T correlation | \|r\| < 0.50 | Not purely difficulty-driven |

=== Data Verification ===

Sample trial: in → wadi
  Clues (first 4): ['desert', 'valley', 'water', 'riverbed']
  Anchor embedding dim: 1536
  Target embedding dim: 1536
  Clue embeddings: 4 x 1536
  A-T distance: 0.7283
  Current relevance: 0.0832
  Current divergence: 77.17

--- Distribution Summary ---
A-T distance:      mean=0.754, std=0.054
Current relevance: mean=0.103, std=0.048
Current divergence: mean=76.9, std=5.1

Fetching vocabulary embeddings from Supabase...
  Fetched 888 embeddings...
  Fetched 1828 embeddings...
  Fetched 2761 embeddings...
  Fetched 3687 embeddings...
  Fetched 4597 embeddings...
  Total: 4597 embeddings
Saving to cache: data/vocab_embeddings.json

Vocabulary ready: 4597 words with embeddings

=== Vocabulary Embedding Verification ===

Sample similarities:
  dog ↔ computer: 0.343
  dog ↔ music: 0.258
  dog ↔ science: 0.299
  computer ↔ music: 0.355
  computer ↔ science: 0.394
  music ↔ science: 0.485

Embedding dimensions: 1536
Vocabulary matrix shape: (4597, 1536)

=== Testing Metric Implementations ===

Test trial: in → wadi
Clues: ['desert', 'valley', 'water', 'riverbed']

--- Approach 1: Discriminative Relevance ---
Generated 50 foil pairs
Percentile rank: 0.980
Discrimination score: 2.084
True pair fit: 0.262

--- Approach 4: Joint Constraint ---
Generated 50 anchor foils, 50 target foils
Overall coverage: 0.860
Overall efficiency: 0.621
Joint score: 0.534

--- Approach 5: Balance ---
Balance: 0.799
Count balance: 0.000
Mean bias: -0.201
Floor attention: 0.262

✓ All metric implementations working correctly

=== Correlation Analysis ===

=== Correlation with Divergence ===
Target: |r| < 0.30 for independence
-----------------------------------------------------------------
disc_percentile_rank                r=-0.113, p=0.2271 ✓ PASS
disc_discrimination_score           r=-0.126, p=0.1773 ✓ PASS
constraint_joint_score              r=+0.055, p=0.5597 ✓ PASS
constraint_overall_coverage         r=-0.068, p=0.4654 ✓ PASS
constraint_overall_efficiency       r=+0.130, p=0.1643 ✓ PASS
balance_balance                     r=-0.162, p=0.0816 ✓ PASS
balance_count_balance               r=-0.239, p=0.0098 ✓ PASS

=== Correlation with Current Relevance ===
(High correlation expected if measuring similar construct)
-----------------------------------------------------------------
disc_percentile_rank                r=+0.311, p=0.0007
disc_discrimination_score           r=+0.362, p=0.0001
constraint_joint_score              r=-0.238, p=0.0102
constraint_overall_coverage         r=+0.009, p=0.9239
constraint_overall_efficiency       r=-0.275, p=0.0028
balance_balance                     r=+0.249, p=0.0070
balance_count_balance               r=+0.144, p=0.1231

=== Correlation with A-T Distance ===
(Check for difficulty confounding, target: |r| < 0.50)
-----------------------------------------------------------------
disc_percentile_rank                r=-0.252, p=0.0063 ✓ OK
disc_discrimination_score           r=-0.026, p=0.7795 ✓ OK
constraint_joint_score              r=+0.022, p=0.8177 ✓ OK
constraint_overall_coverage         r=-0.257, p=0.0053 ✓ OK
constraint_overall_efficiency       r=+0.219, p=0.0184 ✓ OK
balance_balance                     r=-0.051, p=0.5848 ✓ OK
balance_count_balance               r=-0.238, p=0.0100 ✓ OK

figures/metric_correlations.png

=== Distribution Statistics ===

---------------------------------------------------------------------------
Metric                                  Mean       SD      Min      Max    Range
---------------------------------------------------------------------------
disc_percentile_rank                   0.860    0.196    0.080    1.000    0.920
disc_discrimination_score              1.821    1.317   -1.107    4.752    5.859
constraint_joint_score                 0.684    0.127    0.448    0.930    0.482
constraint_overall_coverage            0.897    0.100    0.650    1.000    0.350
constraint_overall_efficiency          0.766    0.128    0.480    0.949    0.469
balance_balance                        0.932    0.048    0.781    0.999    0.218
balance_count_balance                  0.530    0.392    0.000    1.000    1.000

--- Degeneracy Check ---
Criterion: SD > 0.05 for normalized metrics, distribution not concentrated at single value
disc_percentile_rank                SD=0.196, max_bin=61.2% ✓ PASS
disc_discrimination_score           SD=1.317, max_bin=16.4% ✓ PASS
constraint_joint_score              SD=0.127, max_bin=15.5% ✓ PASS
constraint_overall_coverage         SD=0.100, max_bin=31.0% ✓ PASS
constraint_overall_efficiency       SD=0.128, max_bin=16.4% ✓ PASS
balance_balance                     SD=0.048, max_bin=22.4% ✗ FAIL
balance_count_balance               SD=0.392, max_bin=38.8% ✓ PASS

=== Tercile Analysis by Divergence ===

Do metrics vary independently of divergence level?


disc_percentile_rank:
                        mean       std  count
divergence_tercile                           
Low                 0.862051  0.236545     39
Medium              0.853158  0.183673     38
High                0.865128  0.167062     39
ANOVA: F=0.04, p=0.9629
Interpretation: ✓ Independent

disc_discrimination_score:
                        mean       std  count
divergence_tercile                           
Low                 1.888911  1.330864     39
Medium              1.757309  1.338236     38
High                1.814677  1.312694     39
ANOVA: F=0.10, p=0.9092
Interpretation: ✓ Independent

constraint_joint_score:
                        mean       std  count
divergence_tercile                           
Low                 0.678764  0.099339     39
Medium              0.682652  0.149983     38
High                0.689213  0.129030     39
ANOVA: F=0.07, p=0.9354
Interpretation: ✓ Independent

constraint_overall_coverage:
                        mean       std  count
divergence_tercile                           
Low                 0.879231  0.092861     39
Medium              0.915263  0.077799     38
High                0.896667  0.121986     39
ANOVA: F=1.26, p=0.2865
Interpretation: ✓ Independent

constraint_overall_efficiency:
                        mean       std  count
divergence_tercile                           
Low                 0.775165  0.102101     39
Medium              0.745041  0.143703     38
High                0.775940  0.136733     39
ANOVA: F=0.72, p=0.4896
Interpretation: ✓ Independent

balance_balance:
                        mean       std  count
divergence_tercile                           
Low                 0.950668  0.031676     39
Medium              0.911807  0.058450     38
High                0.933167  0.044602     39
ANOVA: F=6.86, p=0.0015
Interpretation: ⚠ Varies with divergence

balance_count_balance:
                        mean       std  count
divergence_tercile                           
Low                 0.602564  0.400320     39
Medium              0.500000  0.419137     38
High                0.487179  0.353315     39
ANOVA: F=1.01, p=0.3661
Interpretation: ✓ Independent


figures/alternative_relevance_metrics.png

figures/new_vs_current_relevance.png

figures/tercile_comparison.png

=== Success Criteria Evaluation ===

------------------------------------------------------------------------------------------
Metric                                 Div r     AT r       SD   All Pass
------------------------------------------------------------------------------------------
disc_percentile_rank                 -0.113✓  -0.252✓   0.196✓     ✓ PASS
disc_discrimination_score            -0.126✓  -0.026✓   1.317✓     ✓ PASS
constraint_joint_score               +0.055✓  +0.022✓   0.127✓     ✓ PASS
constraint_overall_coverage          -0.068✓  -0.257✓   0.100✓     ✓ PASS
constraint_overall_efficiency        +0.130✓  +0.219✓   0.128✓     ✓ PASS
balance_balance                      -0.162✓  -0.051✓   0.048✗     ✗ FAIL
balance_count_balance                -0.239✓  -0.238✓   0.392✓     ✓ PASS
------------------------------------------------------------------------------------------

Metrics passing all criteria: 6
  ✓ disc_percentile_rank
  ✓ disc_discrimination_score
  ✓ constraint_joint_score
  ✓ constraint_overall_coverage
  ✓ constraint_overall_efficiency
  ✓ balance_count_balance

=== Recommendation ===

Metric Ranking (by combined criteria score):
--------------------------------------------------
1. constraint_joint_score              score=7.48 ✓
2. disc_discrimination_score           score=7.11 ✓
3. disc_percentile_rank                score=6.09 ✓
4. constraint_overall_coverage         score=6.03 ✓
5. constraint_overall_efficiency       score=5.75 ✓
6. balance_count_balance               score=4.92 ✓
7. balance_balance                     score=3.86 

==================================================
RECOMMENDATION: Use 'constraint_joint_score' as the new relevance metric

Rationale:
  - Divergence correlation: r=0.055 (target: |r| < 0.30)
  - A-T distance correlation: r=0.022 (target: |r| < 0.50)
  - Standard deviation: 0.127 (meaningful variance)
==================================================

======================================================================
INS-001.2 ALTERNATIVE RELEVANCE METRICS: EXPERIMENT COMPLETE
======================================================================

Analyzed: 116 valid bridging trials
Clues per trial: 4
Foils used: 50

--- Approach Summary ---

Approach 1: Discriminative:
  Status: ✓ 2/2 passed
    disc_percentile_rank: r=-0.113 ✓
    disc_discrimination_score: r=-0.126 ✓

Approach 4: Joint Constraint:
  Status: ✓ 3/3 passed
    constraint_joint_score: r=+0.055 ✓
    constraint_overall_coverage: r=-0.068 ✓
    constraint_overall_efficiency: r=+0.130 ✓

Approach 5: Balance:
  Status: ✓ 1/2 passed
    balance_balance: r=-0.162 ✗
    balance_count_balance: r=-0.239 ✓

--- Final Recommendation ---
Best metric: constraint_joint_score
Passes all criteria: Yes

--- Output Artifacts ---
  data/alternative_relevance_analysis.json
  figures/alternative_relevance_metrics.png
  figures/metric_correlations.png
  figures/new_vs_current_relevance.png
  figures/tercile_comparison.png

======================================================================
EXPERIMENT COMPLETE
======================================================================

