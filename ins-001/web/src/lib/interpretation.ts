/**
 * Interpretation Constants for INS-001 Instruments
 *
 * Centralized interpretation text following brand voice guidelines:
 * - Observational, not evaluative
 * - Data-forward, interpretation-light
 * - Agency-preserving
 *
 * Per lexicon: "The instrument reveals. Interpretation belongs to the participant."
 */

// Methods documentation link
export const METHODS_LINK =
  'https://phronos.org/methods/semantic-association-metrics/spread-fidelity-scoring/';

// =============================================================================
// INS-001.1 SPREAD INTERPRETATIONS
// =============================================================================

export type SpreadBand001_1 = 'low' | 'medium' | 'high';

export interface SpreadInterpretation {
  observation: string;
  implication: string;
}

export const SPREAD_INTERPRETATIONS_001_1: Record<SpreadBand001_1, SpreadInterpretation> = {
  low: {
    observation: 'Your associations clustered in a narrow semantic region.',
    implication: 'This pattern indicates focused, convergent thinking.',
  },
  medium: {
    observation: 'Your associations spanned moderate semantic territory.',
    implication: 'This pattern indicates balanced exploration.',
  },
  high: {
    observation: 'Your associations spanned wide semantic territory.',
    implication: 'This pattern indicates divergent, exploratory thinking.',
  },
};

// INS-001.1 spread band thresholds (normalized 0-100)
export function getSpreadBand001_1(normalizedScore: number): SpreadBand001_1 {
  if (normalizedScore < 33) return 'low';
  if (normalizedScore < 66) return 'medium';
  return 'high';
}

// =============================================================================
// INS-001.1 UNCONVENTIONALITY INTERPRETATIONS
// =============================================================================

export type UnconventionalityLevel = 'low' | 'moderate' | 'high';

export interface UnconventionalityInterpretation {
  observation: string;
  implication: string;
}

export const UNCONVENTIONALITY_INTERPRETATIONS: Record<
  UnconventionalityLevel,
  UnconventionalityInterpretation
> = {
  high: {
    observation: 'None of your associations appeared in the predictable neighborhood.',
    implication: 'Your clues avoided the most common semantic paths.',
  },
  moderate: {
    observation: 'Some of your associations appeared in the predictable neighborhood.',
    implication: 'A mix of conventional and unexpected associations.',
  },
  low: {
    observation: 'Many of your associations appeared in the predictable neighborhood.',
    implication: 'Your clues followed common semantic paths.',
  },
};

// =============================================================================
// INS-001.1 COMMUNICABILITY INTERPRETATIONS
// =============================================================================

export interface CommunicabilityInterpretation {
  success: {
    observation: string;
    implication: string;
  };
  failure: {
    observation: string;
    implication: string;
  };
}

export const COMMUNICABILITY_INTERPRETATIONS: CommunicabilityInterpretation = {
  success: {
    observation: 'Haiku reconstructed the seed from your associations.',
    implication: 'Your clues preserved sufficient signal for reconstruction.',
  },
  failure: {
    observation: 'Haiku could not reconstruct the seed from your associations.',
    implication: 'Your clues may have been too divergent or ambiguous for reconstruction.',
  },
};

// =============================================================================
// INS-001.2 FIDELITY INTERPRETATIONS
// =============================================================================

export type FidelityBand = 'poor' | 'below_average' | 'average' | 'above_average' | 'excellent';

export interface FidelityInterpretation {
  observation: string;
  implication: string;
}

export const FIDELITY_INTERPRETATIONS: Record<FidelityBand, FidelityInterpretation> = {
  poor: {
    observation: 'Your clues leave significant ambiguity about the anchor-target pair.',
    implication: 'Many alternative pairs would fit equally well.',
  },
  below_average: {
    observation: 'Your clues provide partial constraint on the solution.',
    implication: 'Some narrowing, but with redundancy or gaps.',
  },
  average: {
    observation: 'Your clues reasonably triangulate the anchor-target pair.',
    implication: 'Typical constraint efficiency.',
  },
  above_average: {
    observation: 'Your clues efficiently narrow the solution space.',
    implication: 'Complementary coverage with low redundancy.',
  },
  excellent: {
    observation: 'Your clues tightly constrain the anchor-target pair.',
    implication: 'Near-optimal coverage and efficiency.',
  },
};

// INS-001.2 fidelity band thresholds (0-1 scale internally, 0-100 display)
export function getFidelityBand(fidelity: number): FidelityBand {
  // Normalize to 0-1 if passed as 0-100
  const normalized = fidelity > 1 ? fidelity / 100 : fidelity;
  if (normalized < 0.5) return 'poor';
  if (normalized < 0.65) return 'below_average';
  if (normalized < 0.75) return 'average';
  if (normalized < 0.85) return 'above_average';
  return 'excellent';
}

// Human-readable fidelity label
export function getFidelityLabel(band: FidelityBand): string {
  const labels: Record<FidelityBand, string> = {
    poor: 'Poor',
    below_average: 'Below Average',
    average: 'Average',
    above_average: 'Above Average',
    excellent: 'Excellent',
  };
  return labels[band];
}

// =============================================================================
// INS-001.2 SPREAD INTERPRETATIONS (Haiku-calibrated)
// =============================================================================

export type SpreadBand001_2 = 'low' | 'below_average' | 'average' | 'above_average' | 'high';

export const SPREAD_INTERPRETATIONS_001_2: Record<SpreadBand001_2, SpreadInterpretation> = {
  low: {
    observation: 'Your bridges clustered in a narrow semantic region.',
    implication: 'Focused conceptual intersection.',
  },
  below_average: {
    observation: 'Your bridges spanned limited semantic territory.',
    implication: 'Moderate clustering around common ground.',
  },
  average: {
    observation: 'Your bridges spanned typical semantic territory.',
    implication: 'Balanced exploration of the conceptual intersection.',
  },
  above_average: {
    observation: 'Your bridges spanned broad semantic territory.',
    implication: 'Diverse exploration of the conceptual intersection.',
  },
  high: {
    observation: 'Your bridges spanned wide semantic territory.',
    implication: 'Highly divergent exploration of common ground.',
  },
};

// INS-001.2 spread band thresholds (Haiku-calibrated: mean=64.4, SD=4.6)
export function getSpreadBand001_2(spread: number): SpreadBand001_2 {
  if (spread < 55) return 'low';
  if (spread < 62) return 'below_average';
  if (spread < 68) return 'average';
  if (spread < 72) return 'above_average';
  return 'high';
}

// Human-readable spread label for INS-001.2
export function getSpreadLabel001_2(band: SpreadBand001_2): string {
  const labels: Record<SpreadBand001_2, string> = {
    low: 'Low',
    below_average: 'Below Average',
    average: 'Average',
    above_average: 'Above Average',
    high: 'High',
  };
  return labels[band];
}

// =============================================================================
// BASELINE COMPARISONS
// =============================================================================

export interface BaselineComparison {
  delta: number;
  direction: 'higher' | 'lower' | 'comparable';
  text: string;
}

export function generateSpreadComparison(
  participantSpread: number,
  baselineSpread: number,
  baselineName: string
): BaselineComparison {
  const delta = participantSpread - baselineSpread;
  const absDelta = Math.abs(delta);

  if (absDelta <= 5) {
    return {
      delta,
      direction: 'comparable',
      text: `Comparable to ${baselineName}.`,
    };
  }

  if (delta > 0) {
    return {
      delta,
      direction: 'higher',
      text: `More diverse bridges than ${baselineName} (+${Math.round(absDelta)} points).`,
    };
  }

  return {
    delta,
    direction: 'lower',
    text: `${baselineName} found more diverse bridges (+${Math.round(absDelta)} points).`,
  };
}

// =============================================================================
// METHODOLOGY NOTES
// =============================================================================

export const METHODOLOGY_NOTES = {
  ins001_1:
    'Spread measures how far apart your clues are from each other—not creativity, but semantic distance.',
  ins001_2:
    'Fidelity measures how well your clues jointly identify the pair—not correctness. Spread measures how far apart your clues are—not creativity.',
};

// =============================================================================
// VALIDITY THRESHOLDS
// =============================================================================

export const VALIDITY_THRESHOLDS = {
  fidelity: 0.5, // INS-001.2: Fidelity below 0.50 = poor constraint
  relevance: 0.15, // INS-001.1: Relevance below 0.15 = validity warning
};

export function isFidelityValid(fidelity: number): boolean {
  const normalized = fidelity > 1 ? fidelity / 100 : fidelity;
  return normalized >= VALIDITY_THRESHOLDS.fidelity;
}

export const VALIDITY_WARNINGS = {
  fidelity:
    'Your fidelity score is below the threshold. Your clues may not sufficiently narrow down the anchor-target pair.',
};
