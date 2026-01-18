## Part 13: Clue Count Optimization Analysis

### Research Question
How does divergence change as a function of clue count? What is the optimal number of clues for construct validity?

### Rationale
As clue count increases, clue-clue pairs increasingly dominate the full divergence calculation, making the score more comparable to DAT. We analyze:
1. **Divergence trajectory**: How scores evolve from 1→10 clues
2. **Gap to DAT**: At which clue count is the gap minimized?
3. **Pair composition**: How clue-clue proportion changes
4. **Marginal contribution**: Does each additional clue add information?
5. **Optimal N**: Balancing validity, purity, stability, and efficiency

=== Computing Divergence Trajectories ===

  Processed 20 trials...
  Processed 40 trials...
  Processed 60 trials...
  Processed 80 trials...
  Processed 100 trials...

Computed 1140 trajectory points across 114 trials
  Clue counts: 1-10
  Points per trial: 10

  === Aggregate Statistics by Clue Count ===

DAT Reference: mean=74.10, SD=1.56

Divergence by Clue Count
==========================================================================================
  N   Full Div     (SD)  Clue-Only    Pairs CC Pairs      Gap   Trials
------------------------------------------------------------------------------------------
  1       68.6      5.2          —        3        0     +5.5      114
  2       66.8      5.1       61.6        6        1     +7.3      114
  3       66.4      4.8       63.3       10        3     +7.7      114
  4       66.3      4.7       64.1       15        6     +7.8      114
  5       66.2      4.7       64.4       21       10     +7.9      114
  6       66.0      4.7       64.7       28       15     +8.1      114
  7       66.1      4.5       65.0       36       21     +8.0      114
  8       65.9      4.3       64.9       45       28     +8.2      114
  9       66.0      4.3       65.1       55       36     +8.1      114
 10       66.2      4.1       65.4       66       45     +7.9      114

Minimum gap (full divergence): 1 clues (gap = +5.47)
Minimum gap (clue-only divergence): 10 clues (gap = +8.68)

Figure: Divergence Trajectory.png

=== Marginal Contribution Analysis ===

Change in full divergence when adding each clue:
----------------------------------------------------------------------
      Step     Mean Δ         SD          t          p    Sig
----------------------------------------------------------------------
    1_to_2     -1.845      3.227      -6.10     0.0000    ***
    2_to_3     -0.429      2.430      -1.88     0.0623       
    3_to_4     -0.062      1.747      -0.38     0.7064       
    4_to_5     -0.074      1.421      -0.56     0.5789       
    5_to_6     -0.188      1.283      -1.57     0.1203       
    6_to_7     +0.089      0.970       0.97     0.3318       
    7_to_8     -0.232      1.011      -2.45     0.0158      *
    8_to_9     +0.103      0.795       1.39     0.1680       
   9_to_10     +0.161      0.859       2.01     0.0471      *

Non-significant marginal contributions: 2_to_3, 3_to_4, 4_to_5, 5_to_6, 6_to_7, 8_to_9
  Interpretation: After 2 clues, additional clues may not add meaningful divergence.

Figure: Marginal Contribution Analysis.png

=== Optimal Clue Count Determination ===

Note: Excluding n=1 (no clue-clue pairs, cannot measure divergence)

Weights: Gap=0.35, Proportion=0.3, Stability=0.2, Efficiency=0.15

Optimization Scores by Clue Count
=====================================================================================
  N      Gap     Prop     Stab      Eff  Composite   Full Div   Gap to DAT
-------------------------------------------------------------------------------------
  2    0.110    0.167    0.000    1.000      0.238       66.8         +7.3
  3    0.057    0.300    0.065    0.875      0.254       66.4         +7.7
  4    0.050    0.400    0.076    0.750      0.265       66.3         +7.8
  5    0.040    0.476    0.073    0.625      0.265       66.2         +7.9
  6    0.018    0.536    0.086    0.500      0.259       66.0         +8.1
  7    0.028    0.583    0.120    0.375      0.265       66.1         +8.0
  8    0.000    0.622    0.147    0.250      0.254       65.9         +8.2
  9    0.012    0.655    0.161    0.125      0.252       66.0         +8.1
 10    0.033    0.682    0.190    0.000      0.254       66.2         +7.9

OPTIMAL CLUE COUNT: 4

At 4 clues:
  - Full divergence: 66.30 (gap to DAT: +7.80)
  - Total pairs: 15
  - Clue-clue pairs: 6 (40.0% of total)
  - Score SD: 4.71

  Figure: Optimal Clue Count Selection.png

  ======================================================================
CLUE COUNT OPTIMIZATION: SUMMARY
======================================================================

1. TRAJECTORY FINDINGS
----------------------------------------
   As clue count increases from 1→10:
   - Full divergence: 68.6 → 66.2
   - Gap to DAT: +5.5 → +7.9
   - Clue-clue proportion: 0% → 68.2%

2. OPTIMAL CLUE COUNT
----------------------------------------
   Recommended: 4 clues
   Rationale:
   - Balances construct validity (gap to DAT)
   - Maximizes participant-generated pair proportion
   - Maintains measurement stability
   - Avoids excessive task burden

3. CALIBRATION AT OPTIMAL N
----------------------------------------
   Calibration adjustment: +7.80 points
   Example: INS-001.2 score of 70 → DAT-equivalent of 78

4. IMPLEMENTATION RECOMMENDATION
----------------------------------------
   Use 4 clues in production INS-001.2
   This maintains reasonable task length while optimizing construct validity.

5. EXPORT
----------------------------------------
   Parameters saved to: data/optimal_clue_count_params.json

======================================================================
ANALYSIS COMPLETE
======================================================================