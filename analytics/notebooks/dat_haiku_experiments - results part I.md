# DAT and Bridging Experiments: Haiku Semantic Divergence

This notebook evaluates Claude Haiku's divergent association capacity using:
1. **Divergent Association Task (DAT)** - per Olson et al. 2021
2. **Bridging Task** - INS-001.2 semantic union scoring

## Pre-Registration: Success Criteria

| Hypothesis | Criterion |
|------------|-----------|
| Haiku performs comparably to humans | Mean DAT score within 1 SD of human norm (78 ± 6 → 72-84) |
| Temperature affects divergence | Significant linear trend (p < 0.05) OR optimal at intermediate temp |
| Embedding model matters | Correlation between GloVe/OpenAI scores < 0.85 |
| Prompt framing affects scores | > 5 point difference between olson_original and paraphrased |
| Technical framing triggers optimization | semantic_distance scores > olson_original by > 3 points |
| DAT-Bridging share underlying capacity | Within-temperature correlation r > 0.5 |

Experiment metadata:
  experiment_name: DAT and Bridging Experiments
  started_at: 2026-01-17T08:32:38.529504
  random_seed: 42
  haiku_model: claude-haiku-4-5-20251001
  openai_embedding_model: text-embedding-3-small
  glove_model: glove-wiki-gigaword-300

  Loading API keys from /Users/vishal/Documents/Secrets/instruments-keys.env
Rate limiting enabled: 50 req/min, 1.30s between calls
Temperatures: [0.0, 0.3, 0.5, 0.7, 1.0]
Prompt variants: ['olson_original', 'paraphrased', 'semantic_distance']
DAT parameters: 7 words, 21 pairs
Human norms: mean=78, sd=6
API clients initialized successfully!

Human Norms (Olson et al. 2021):
  Mean: 78
  SD: 6
  Range for 'comparable to humans': 72-84

  Loading GloVe model (this may take a minute on first run)...
GloVe loaded: 400,000 words, 300 dimensions

Computing random baselines (N=1000 samples each)...

Random Baselines:
  Uniform sampling:   mean=89.8, sd=4.2
  Freq-weighted:      mean=87.5, sd=10.2

Computing ceiling estimate with greedy algorithm...

Ceiling Estimate:
  Max score found: 110.8
  Mean greedy: 109.9 (sd=0.4)
  Best words: ['theravadin', 'and', 'ondul', ':', 'kd95', 'cove', 'dbkom']


Noun validation test:
  dog: ✓ valid noun
  cat: ✓ valid noun
  quickly: ✗ not valid
  beautiful: ✗ not valid
  xyz123: ✗ not valid
  running: ✓ valid noun
  happiness: ✓ valid noun

Testing embedding functions...
  GloVe: 3 embeddings, dim=300
  OpenAI: 3 embeddings, dim=1536

Prompt Variants:

--- olson_original ---
Generate 10 nouns that are as different from each other as possible, 
in all meanings and uses of th...

--- paraphrased ---
List 10 nouns with minimal semantic overlap. 
Each word should be as unrelated as possible to all th...

--- semantic_distance ---
Select 10 nouns that maximize average pairwise cosine distance 
in a word embedding space. Output on...

Running determinism check at temperature=0.0...
(Running 5 trials with identical prompts)

Trial 1: ['telescope', 'democracy', 'mushroom', 'symphony', 'glacier', 'algorithm', 'butterfly']
Trial 2: ['telescope', 'democracy', 'mushroom', 'symphony', 'glacier', 'algorithm', 'butterfly']
Trial 3: ['telescope', 'butterfly', 'democracy', 'granite', 'symphony', 'algorithm', 'nostalgia']
Trial 4: ['telescope', 'democracy', 'mushroom', 'symphony', 'glacier', 'algorithm', 'butterfly']
Trial 5: ['telescope', 'democracy', 'mushroom', 'symphony', 'glacier', 'algorithm', 'butterfly']

✗ Determinism check: 2 unique response(s)
WARNING: API has stochasticity even at temp=0. Will treat temp=0 as single observation.

Running pilot trials (N=5 at temp=0.7)...
This will compute both GloVe and OpenAI scores.

Pilot trial 1/5... GloVe=97.0, OpenAI=73.2
Pilot trial 2/5... GloVe=96.3, OpenAI=76.3
Pilot trial 3/5... GloVe=96.5, OpenAI=77.5
Pilot trial 4/5... GloVe=98.6, OpenAI=76.9
Pilot trial 5/5... GloVe=97.4, OpenAI=78.8

Pilot Results (5/5 valid):
  GloVe:  mean=97.1, sd=0.8
  OpenAI: mean=76.5, sd=1.9


Power Analysis (80% power, alpha=0.05)
Using pilot SD = 0.8

  Haiku vs Human mean (effect=5.0): N = 1 per group
  Adjacent temperatures (effect=3.0): N = 2 per group
  Prompt variants (effect=5.0): N = 1 per group

Recommended N per condition: 10
Total trials (5 temps × 3 prompts): 150

Running pilot for prompt variants (N=10 per variant)...

olson_original:
  Trial 1: score=97.5, valid=True
  Trial 2: score=97.8, valid=True
  Trial 3: score=95.5, valid=True
  Trial 4: score=96.8, valid=True
  Trial 5: score=96.1, valid=True
  Trial 6: score=96.5, valid=True
  Trial 7: score=97.3, valid=True
  Trial 8: score=95.5, valid=True
  Trial 9: score=98.3, valid=True
  Trial 10: score=98.2, valid=True

paraphrased:
  Trial 1: score=92.4, valid=True
  Trial 2: score=95.7, valid=True
  Trial 3: score=92.9, valid=True
  Trial 4: score=92.6, valid=True
  Trial 5: score=92.3, valid=True
  Trial 6: score=95.7, valid=True
  Trial 7: score=90.6, valid=True
  Trial 8: score=93.2, valid=True
  Trial 9: score=91.3, valid=True
  Trial 10: score=94.1, valid=True

semantic_distance:
  Trial 1: score=96.6, valid=True
  Trial 2: score=98.0, valid=True
  Trial 3: score=93.3, valid=True
  Trial 4: score=93.5, valid=True
  Trial 5: score=95.6, valid=True
  Trial 6: score=96.6, valid=True
  Trial 7: score=94.3, valid=True
  Trial 8: score=94.0, valid=True
  Trial 9: score=96.6, valid=True
  Trial 10: score=94.5, valid=True

--- Prompt Variant Pilot Summary ---
olson_original: mean=96.9, sd=1.0 (10/10 valid)
paraphrased: mean=93.1, sd=1.6 (10/10 valid)
semantic_distance: mean=95.3, sd=1.5 (10/10 valid)

Technical framing effect: -1.6 points (hypothesis: > 3 points)

Running main experiment:
  N per condition: 10 (except temp=0: 10)
  Temperatures: [0.0, 0.3, 0.5, 0.7, 1.0]
  Prompt variants: ['olson_original', 'paraphrased', 'semantic_distance']

=== olson_original ===
  temp=0.0: .......... mean=96.7
  temp=0.3: .......... mean=97.2
  temp=0.5: .......... mean=97.1
  temp=0.7: .......... mean=97.4
  temp=1.0: .......... mean=97.6

=== paraphrased ===
  temp=0.0: .......... mean=94.1
  temp=0.3: .......... mean=92.6
  temp=0.5: .......... mean=91.2
  temp=0.7: .......... mean=93.4
  temp=1.0: .......... mean=93.8

=== semantic_distance ===
  temp=0.0: .......... mean=93.7
  temp=0.3: .......... mean=94.1
  temp=0.5: .......... mean=94.5
  temp=0.7: .......... mean=94.7
  temp=1.0: .......... mean=94.4


Total trials: 150
Valid trials: 150

Raw responses saved to: data/dat_raw_responses.json
  Total trials: 150
  File size: 348.0 KB

=== Data Validation ===

Total trials: 150
Valid trials (7+ nouns): 150 (100.0%)
Invalid trials: 0 (0.0%)

--- Validity by Condition ---
                               sum  count  pct_valid
prompt_variant    temperature                       
olson_original    0.0           10     10      100.0
                  0.3           10     10      100.0
                  0.5           10     10      100.0
                  0.7           10     10      100.0
                  1.0           10     10      100.0
paraphrased       0.0           10     10      100.0
                  0.3           10     10      100.0
                  0.5           10     10      100.0
                  0.7           10     10      100.0
                  1.0           10     10      100.0
semantic_distance 0.0           10     10      100.0
                  0.3           10     10      100.0
                  0.5           10     10      100.0
                  0.7           10     10      100.0
                  1.0           10     10      100.0

✓ Exclusion rate (0.0%) is acceptable.

Using 150 valid trials for analysis.


=== Aggregate Statistics ===

--- Overall (all valid trials) ---
GloVe:  mean=94.8, sd=2.4
OpenAI: mean=74.1, sd=1.6

--- By Temperature (GloVe scores) ---
             mean  std  count
temperature                  
0.0          94.8  1.7     30
0.3          94.6  2.3     30
0.5          94.3  3.0     30
0.7          95.2  2.4     30
1.0          95.3  2.5     30

--- By Prompt Variant (GloVe scores) ---
                   mean  std  count
prompt_variant                     
olson_original     97.2  1.2     50
paraphrased        93.0  1.9     50
semantic_distance  94.3  1.9     50

--- Full Condition Matrix (GloVe mean scores) ---
temperature         0.0   0.3   0.5   0.7   1.0
prompt_variant                                 
olson_original     96.7  97.2  97.1  97.4  97.6
paraphrased        94.1  92.6  91.2  93.4  93.8
semantic_distance  93.7  94.1  94.5  94.7  94.4


=== Embedding Model Comparison ===

Pearson correlation: r = 0.595, p = 0.0000
Paired t-test: t = 129.510, p = 0.0000
Mean difference (GloVe - OpenAI): 20.74

✓ Hypothesis supported: Embedding model matters (r=0.595 < 0.85)
# Figure: Embedding Model Comparison
=== Temperature Effects ===

Linear regression: score = 94.6 + 0.6 × temperature
  R² = 0.006
  p = 0.3349
  slope = 0.56 ± 0.58

One-way ANOVA: F = 0.804, p = 0.5246

✗ No significant linear trend (p=0.3349)
# Figure: DAT Scores by Temperature.png

=== Comparison vs Baselines ===

Haiku mean: 94.8 (sd=2.4)
Human norm: 78 (sd=6)
Human 1-SD range: 72-84

✗ Hypothesis not supported: Haiku mean (94.8) outside human range
  Difference from human mean: +16.8 points

--- vs Random Baselines ---
Random (uniform): 89.8
Random (freq-weighted): 87.3
Haiku advantage over random (uniform): +5.1
Haiku advantage over random (weighted): +7.6
# Figure: DAT Scores vs Baselines.png


=== Pairwise Distance Distribution ===

Total pairwise distances (GloVe): 3150
Total pairwise distances (OpenAI): 3150

GloVe distances:
  Mean: 0.948
  Std:  0.093
  Min:  0.539
  Max:  1.147


Figure: Glove vs OpenAI.png


=== Bridging Results ===

Total trials: 100
Valid trials: 10

--- By Temperature ---
            relevance        divergence        valid
                 mean    std       mean    std count
temperature                                         
0.0             0.175  0.031     70.686  4.952     2
0.3             0.162  0.013     72.379  7.346     2
0.5             0.171  0.026     70.333  4.452     2
0.7             0.175  0.031     70.686  4.952     2
1.0             0.160  0.010     70.868  5.208     2

Figure: Bridging Results by Temperature.png

=== DAT-Bridging Correlation ===

Does high DAT score predict good bridging performance?

Across-temperature correlation:
  r = -0.064, p = 0.9188

--- Within-Temperature Correlations ---
(Correlation between DAT and bridging scores within each temperature condition)
  temp=0.0: DAT mean=94.8, Bridge mean=70.7
  temp=0.3: DAT mean=94.6, Bridge mean=72.4
  temp=0.5: DAT mean=94.3, Bridge mean=70.3
  temp=0.7: DAT mean=95.2, Bridge mean=70.7
  temp=1.0: DAT mean=95.3, Bridge mean=70.9

Note: DAT and bridging use different trials, so within-temperature correlation
      would require matched subject/trial design. Here we compare aggregate means.

✗ Low across-temp correlation (r=-0.064) suggests distinct capacities

# Figure: DAT_vs_bridging_vs_temperature.png

