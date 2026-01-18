# INS-001.2 Results Interpretation Update

## Overview

Update the results interpretation logic based on the DAT calibration study findings. No changes to scoring algorithms—only to how results are interpreted and displayed.

## Summary of Changes

1. **Relevance**: Treat as validity gate only, not a comparative metric
2. **Spread thresholds**: Update from DAT-based to Haiku-calibrated bands
3. **Interpretation text**: Revise to reflect the relevance-spread tradeoff correctly

---

## 1. Relevance Interpretation

### Current Behavior (REMOVE)
The current interpretation compares relevance across baselines ("on par with Haiku", "higher than statistical model").

### New Behavior
Relevance is a **validity gate only**. Do not compare relevance values between participant and baselines.

```python
# OLD: Comparing relevance values
"Your relevance (25) is on par with Haiku, and on par with the statistical model."

# NEW: Only check validity threshold
if relevance < 0.15:
    "Your submission did not meet the relevance threshold. Your clues may not sufficiently bridge the anchor and target."
else:
    # Don't mention relevance in interpretation at all
    # Proceed directly to spread interpretation
```

### Rationale
- Relevance and spread have r = -0.61 correlation (tradeoff)
- Comparing relevance is misleading—lower relevance often accompanies higher spread
- Relevance serves to filter invalid submissions, not measure performance

---

## 2. Spread Thresholds

### Current Thresholds (UPDATE)
Based on DAT norms (human mean = 78):

| Score | Label |
|-------|-------|
| < 50 | Low |
| 50–65 | Below average |
| 65–80 | Average |
| 80–90 | Above average |
| > 90 | High |

### New Thresholds (Haiku-Calibrated)
Based on Haiku baseline (mean = 64.4, SD = 4.6):

| Score | Label | Description |
|-------|-------|-------------|
| < 55 | Low | Well below typical bridging performance |
| 55–62 | Below Average | Limited semantic exploration |
| 62–68 | Average | Typical bridging performance |
| 68–72 | Above Average | Wide-ranging associations |
| > 72 | High | Exceptional spread |

```python
def get_spread_label(spread: float) -> str:
    if spread < 55:
        return "low"
    elif spread < 62:
        return "below average"
    elif spread < 68:
        return "average"
    elif spread < 72:
        return "above average"
    else:
        return "high"
```

---

## 3. Interpretation Text Templates

### Invalid Submission (relevance < 0.15)
```
Your submission did not meet the relevance threshold ({relevance:.0f}). 
This may indicate your clues don't sufficiently connect to both the anchor and target. 
Try finding concepts that bridge both words.
```

### Valid Submission - Spread Comparison
Replace the current interpretation with spread-focused comparison:

```python
def generate_interpretation(
    participant_spread: float,
    haiku_spread: float,
    statistical_spread: float,
    participant_relevance: float
) -> str:
    
    # Check validity first
    if participant_relevance < 0.15:
        return f"Your submission did not meet the relevance threshold ({participant_relevance*100:.0f}). Your clues may not sufficiently bridge the anchor and target."
    
    # Spread comparison
    spread_label = get_spread_label(participant_spread)
    delta_haiku = participant_spread - haiku_spread
    delta_statistical = participant_spread - statistical_spread
    
    # Build interpretation
    parts = []
    
    # Main spread statement
    parts.append(f"Your spread ({participant_spread:.0f}) is {spread_label}.")
    
    # Haiku comparison
    if delta_haiku > 5:
        parts.append(f"You found more diverse bridges than Haiku (+{delta_haiku:.0f} points).")
    elif delta_haiku < -5:
        parts.append(f"Haiku found more diverse bridges ({abs(delta_haiku):.0f} points higher).")
    else:
        parts.append("Your spread is comparable to Haiku.")
    
    # Statistical comparison (optional, can remove)
    if delta_statistical > 5:
        parts.append(f"Your concepts are more diverse than the statistical baseline.")
    elif delta_statistical < -5:
        parts.append(f"The statistical baseline found more diverse bridges.")
    
    return " ".join(parts)
```

### Example Outputs

**Example 1: High spread (like the screenshot)**
```
Your spread (71) is above average. You found more diverse bridges than Haiku (+7 points).
```

**Example 2: Average spread**
```
Your spread (65) is average. Your spread is comparable to Haiku.
```

**Example 3: Low spread**
```
Your spread (52) is low. Haiku found more diverse bridges (12 points higher). 
Try finding concepts that are more distinct from each other.
```

---

## 4. UI Display Changes

### Current UI
Shows both RELEVANCE and SPREAD as filled dots on the scale for all three baselines.

### Recommended Changes

1. **Remove relevance comparison bars** for Haiku and Statistical baselines
   - Only show participant's relevance as a validity indicator (green check if ≥ 0.15, warning if < 0.15)
   
2. **Keep spread comparison bars** for all three
   - This is the meaningful comparison

3. **Alternative**: Keep current visual but update interpretation text only
   - Less disruptive change
   - Interpretation text clarifies that spread is the primary metric

---

## 5. Files to Update

### `scoring.py` or `scoring_bridging.py`
- No changes to scoring algorithms
- Optionally add `get_spread_label()` helper function

### Interpretation/Results Component
- Update `generate_interpretation()` or equivalent
- Remove relevance comparison logic
- Update spread threshold constants

### Constants/Config
```python
# Haiku-calibrated spread thresholds
SPREAD_THRESHOLDS = {
    "low": 55,
    "below_average": 62,
    "average": 68,
    "above_average": 72
}

# Validity threshold (unchanged)
RELEVANCE_VALIDITY_THRESHOLD = 0.15
```

---

## 6. Validation Checklist

After implementation, verify:

- [ ] Submissions with relevance < 0.15 show validity warning
- [ ] Submissions with relevance ≥ 0.15 do NOT compare relevance to baselines
- [ ] Spread thresholds use new Haiku-calibrated bands
- [ ] Interpretation text focuses on spread comparison
- [ ] "Above average" now means > 68 (not > 80)
- [ ] Haiku comparison uses delta (participant - haiku) correctly

---

## 7. Documentation Reference

See MTH-002.1 v2.0 for full calibration study details:
- Haiku baseline: mean = 64.4, SD = 4.6 (5 clues)
- Relevance-spread tradeoff: r = -0.61
- Pair difficulty moderation effects
