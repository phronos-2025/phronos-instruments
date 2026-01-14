# INS-001.1 Update Plan

## Summary
Update INS-001.1 (Signal) to:
1. Require 1-5 concepts (not exactly 5 clues)
2. Rename "clues" to "concepts" throughout
3. Add morphological overlap validation (port from INS-001.2)
4. Update results UI to match INS-001.2 style
5. Remove "Preliminary Classification" section

---

## File Changes

### 1. CluesScreen.tsx → Rename & Update Validation
**File:** `ins-001/web/src/components/screens/CluesScreen.tsx`

**Changes:**
- Rename terminology: "clues" → "concepts" in UI text
- Change from exactly 5 required to 1-5 (1 required, 4 optional)
- Port `getWordStem()` and `isMorphologicalVariant()` functions from `BridgingStepsScreen.tsx` (lines 20-54)
- Add validation logic:
  - Cannot be morphological variant of seed word
  - Cannot duplicate another concept (morphologically)
- Add real-time validation UI (green ✓ / red ✗ like INS-001.2)
- Update Panel title from "Your Clues" to "Your Concepts"
- Update meta from "5 required" to "1-5 concepts"
- Update description text
- Update submit button enablement logic: `validFilledCount >= 1 && !hasInvalidConcepts`

### 2. ClueInput.tsx → Update for New Validation
**File:** `ins-001/web/src/components/ui/ClueInput.tsx`

**Changes:**
- Add validation status prop for morphological validation
- Update to show red ✗ for invalid (not just warning for noise floor)
- Show "(optional)" for empty slots after first
- Match styling from BridgingStepsScreen.tsx (lines 217-276)

**OR Alternative:** Inline the input rendering directly in CluesScreen.tsx like BridgingStepsScreen does, for consistency.

### 3. ResultsScreen.tsx → Update UI Style
**File:** `ins-001/web/src/components/screens/ResultsScreen.tsx`

**Changes:**
- **Remove ArchetypeDisplay import and usage** (lines 14, 64, 107)
- Update layout to match BridgingResultsScreen style:
  - Add Panel wrapper around score visualization
  - Use barbell/dot plot visualization instead of score grid cards
  - Show seed word prominently at top
  - Add legend for metrics
  - Show axis scale (0-100)
- Update metrics display:
  - Divergence: filled dot (gold)
  - Convergence: hollow dot (gold outline)
  - Connecting line between dots
- Keep "Claude's Guesses" panel
- Keep "Interpretation" panel
- Keep "Unregistered Record" panel
- Keep footer

### 4. ArchetypeDisplay.tsx → Delete or Mark Unused
**File:** `ins-001/web/src/components/ui/ArchetypeDisplay.tsx`

**Action:** Can be deleted since INS-001.1 was its only usage. Or leave for future use.

### 5. state.tsx → Update Types (if needed)
**File:** `ins-001/web/src/lib/state.tsx`

**Check:** Ensure state types support 1-5 clues/concepts instead of exactly 5.

### 6. IntroScreen.tsx → Update Terminology
**File:** `ins-001/web/src/components/screens/IntroScreen.tsx`

**Changes:** Update any references from "clues" to "concepts" in intro text.

---

## Implementation Order

1. **Port morphological validation functions** to a shared utility or directly into CluesScreen
2. **Update CluesScreen.tsx** with new validation and 1-5 concept requirement
3. **Update ClueInput.tsx** or inline the inputs
4. **Update ResultsScreen.tsx** to remove archetype and add barbell visualization
5. **Update IntroScreen.tsx** terminology
6. **Test the flow** end-to-end

---

## Code to Port from BridgingStepsScreen.tsx

```typescript
// Morphological variant detection (lines 20-54)
function getWordStem(word: string): string {
  word = word.toLowerCase();
  const suffixes = [
    'ically', 'ation', 'ness', 'ment', 'able', 'ible', 'tion',
    'sion', 'ally', 'ful', 'less', 'ing', 'ity', 'ous', 'ive',
    'est', 'ier', 'ies', 'ied', 'ly', 'ed', 'er', 'en', 'es', 's'
  ];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

function isMorphologicalVariant(word1: string, word2: string): boolean {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();

  // Exact match
  if (w1 === w2) return true;

  // One is substring of the other (catches most plurals/verb forms)
  if (w1.startsWith(w2) || w2.startsWith(w1)) {
    if (Math.abs(w1.length - w2.length) <= 4) {
      return true;
    }
  }

  // Same stem
  if (getWordStem(w1) === getWordStem(w2)) return true;

  return false;
}
```

---

## Results UI Target (from BridgingResultsScreen)

The barbell/dot plot visualization shows:
- **Axis**: 0 to 100 scale with gridlines at 25, 50, 75
- **Legend**: Filled dot = Relevance, Hollow dot = Spread (or in INS-001.1: Divergence/Convergence)
- **Row**: Label on left, track with dots and connecting line

For INS-001.1:
- Single row showing user's divergence (filled) and convergence (hollow)
- Concepts displayed above the track
- Keep existing Claude's Guesses panel below

---

## Notes

- The `DotPlotRow` component from BridgingResultsScreen.tsx (lines 36-175) can be extracted to a shared component or adapted for INS-001.1
- INS-001.1 only needs one row (the user's), whereas INS-001.2 shows multiple comparison rows
- Seed word should be displayed prominently like the anchor/target in INS-001.2
