import { useCallback, useState } from "react";
import type { Rubric, ScoreMap, Weights } from "../types/index.ts";
import { RUBRICS } from "../types/index.ts";

const DEFAULT_WEIGHTS: Weights = {
  logic: 25,
  evidence: 25,
  persuasion: 25,
  originality: 25,
};

/**
 * Redistribute remaining weight across other rubrics proportionally.
 * Exported for unit testing.
 */
export function redistributeWeights(
  current: Weights,
  changedRubric: Rubric,
  newValue: number,
): Weights {
  const clamped = Math.max(0, Math.min(100, Math.round(newValue)));
  const remaining = 100 - clamped;
  const others = RUBRICS.filter((r) => r !== changedRubric);

  // Sum of the other rubrics' current values
  const othersSum = others.reduce((sum, r) => sum + current[r], 0);

  let result: Weights;

  if (othersSum === 0) {
    // All others are zero — split equally
    const each = Math.floor(remaining / others.length);
    const leftover = remaining - each * others.length;
    result = { ...current, [changedRubric]: clamped };
    others.forEach((r, i) => {
      result[r] = each + (i < leftover ? 1 : 0);
    });
  } else {
    // Proportional redistribution
    result = { ...current, [changedRubric]: clamped };
    let distributed = 0;
    others.forEach((r, i) => {
      if (i === others.length - 1) {
        // Last one gets whatever is left (avoid rounding drift)
        result[r] = remaining - distributed;
      } else {
        const proportion = current[r] / othersSum;
        const value = Math.round(remaining * proportion);
        result[r] = value;
        distributed += value;
      }
    });
  }

  return result;
}

/**
 * Compute weighted average score from a ScoreMap and weights.
 * Returns 0 if no valid scores exist.
 */
export function computeComposite(scores: ScoreMap, weights: Weights): number {
  let numerator = 0;
  let denominator = 0;

  for (const rubric of RUBRICS) {
    const score = scores[rubric];
    if (score != null) {
      numerator += score * weights[rubric];
      denominator += weights[rubric];
    }
  }

  if (denominator === 0) return 0;
  return numerator / denominator;
}

export function useWeights() {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);

  const setWeight = useCallback(
    (rubric: Rubric, value: number) => {
      setWeights((prev) => redistributeWeights(prev, rubric, value));
    },
    [],
  );

  const resetWeights = useCallback(() => {
    setWeights(DEFAULT_WEIGHTS);
  }, []);

  return { weights, setWeight, resetWeights };
}
