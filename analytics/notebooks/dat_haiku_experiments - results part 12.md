## Part 12: Pair Difficulty Moderation Analysis

### Research Question
Does anchor-target distance (pair difficulty) moderate the constraint effect on clue-clue divergence?

**Hypothesis**: When endpoints are far apart (hard pairs), Haiku may have more "room" to spread clues, leading to higher clue-clue divergence. Conversely, when endpoints are close (easy pairs), clues may cluster together.

### Analysis Plan
1. **Correlation Analysis**: Correlate anchor-target distance with clue-clue divergence
2. **Visualization**: Scatter plots with regression lines and residual analysis
3. **Tercile Analysis**: Compare easy/medium/hard pairs using ANOVA
4. **Implications**: Determine if calibration should be pair-difficulty-stratified

=== Pair Difficulty Moderation Analysis ===

Trials analyzed: 116
Clue-clue pairs per trial: 45

--- Correlation Analysis ---

1. Anchor-Target Distance vs Clue-Clue Divergence:
   Pearson r = 0.2248, p = 0.0152
   ✓ Significant: harder pairs → more spread

2. Anchor-Target Distance vs Full Divergence:
   Pearson r = 0.3547, p = 0.0001
   ✓ Significant: pair difficulty affects overall divergence score

3. Clue-Prompt Distance vs Clue-Clue Distance:
   Pearson r = 0.7419, p = 0.0000
   ✓ Significant positive: less relevant clues → more divergent from each other

--- Robustness: Spearman Correlations ---

A-T vs Clue-Clue: ρ = 0.2605
A-T vs Full Div:  ρ = 0.3500

Residual Analysis:
  Mean residual: -0.0000
  Residual SD: 4.4188
  Residual range: [-11.97, 9.04]

  Heteroscedasticity check (|residuals| vs predicted):
    r = 0.0856, p = 0.3606
    ✓ No significant heteroscedasticity
#Figure: pair difficulty vs clue spread vs full score.png

=== Tercile Analysis: Easy/Medium/Hard Pairs ===

Tercile Statistics:
----------------------------------------------------------------------
  Easy    : n= 39, A-T dist=0.6956, clue-clue div=63.75 (SD=3.85)
  Medium  : n= 38, A-T dist=0.7541, clue-clue div=64.84 (SD=4.64)
  Hard    : n= 39, A-T dist=0.8114, clue-clue div=67.55 (SD=4.38)

--- One-Way ANOVA: Clue-Clue Divergence by Difficulty ---

F-statistic: 8.0784
p-value: 0.0005

✓ Significant effect: Pair difficulty moderates clue-clue divergence
Effect size (η²): 0.1251
  Effect size: medium

Post-hoc Pairwise Comparisons (Bonferroni-corrected α = 0.017):
  Easy vs Medium: Δ=-1.10, t=-1.129, p=0.2626 
  Easy vs Hard: Δ=-3.80, t=-4.074, p=0.0001 ***
  Medium vs Hard: Δ=-2.71, t=-2.634, p=0.0102 *
/var/folders/c2/g0c1jz_n4zx8d5xdtn4t9xy00000gn/T/ipykernel_46547/768522636.py:13: FutureWarning: The default of observed=False is deprecated and will be changed to True in a future version of pandas. Pass observed=False to retain current behavior or observed=True to adopt the future default and silence this warning.
  tercile_stats = mod_df.groupby("difficulty_tercile").agg({
Figure: clue spread by pair difficulty.png

======================================================================
PAIR DIFFICULTY MODERATION ANALYSIS: SUMMARY
======================================================================

1. CORRELATION FINDINGS
----------------------------------------
   • A-T distance → clue-clue divergence: r=0.225 (p=0.0152) ✓
     Interpretation: Harder pairs allow MORE clue spread
   • A-T distance → full divergence: r=0.355 (p=0.0001) ✓
     (Expected: harder pairs have higher full divergence)

2. TERCILE ANALYSIS
----------------------------------------
   • Easy pairs:   clue-clue div = 63.75
   • Medium pairs: clue-clue div = 64.84
   • Hard pairs:   clue-clue div = 67.55
   • ANOVA: F=8.08, p=0.0005

3. CALIBRATION RECOMMENDATION
----------------------------------------
   ⚠ MODERATION DETECTED
   Recommendation: Consider pair-stratified calibration
   - Compute separate adjustment factors for easy/medium/hard pairs
   - Or regress divergence on A-T distance and adjust residuals

4. UPDATING CALIBRATION PARAMETERS
----------------------------------------
   Updated: data/dat_calibration_params.json
   Recommendation: pair_stratified

5. STRATIFIED CALIBRATION FUNCTION
----------------------------------------
   Easy pair adjustment:   +10.35
   Medium pair adjustment: +9.26
   Hard pair adjustment:   +6.55

   A-T distance thresholds:
     Easy:   < 0.7267
     Medium: 0.7267 - 0.7773
     Hard:   > 0.7773

   Stratified calibration parameters saved.

======================================================================
ANALYSIS COMPLETE
======================================================================

