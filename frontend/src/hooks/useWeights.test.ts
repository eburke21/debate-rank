import { describe, it, expect } from "vitest";
import { redistributeWeights, computeComposite } from "./useWeights.ts";
import type { Weights, ScoreMap } from "../types/index.ts";

const DEFAULT: Weights = { logic: 25, evidence: 25, persuasion: 25, originality: 25 };

describe("redistributeWeights", () => {
  it("preserves sum of 100 when adjusting a single rubric", () => {
    const result = redistributeWeights(DEFAULT, "logic", 60);
    const sum = result.logic + result.evidence + result.persuasion + result.originality;
    expect(sum).toBe(100);
    expect(result.logic).toBe(60);
  });

  it("distributes remaining weight proportionally to other rubrics", () => {
    // Starting from 25/25/25/25, set logic to 100 → others should be 0
    const result = redistributeWeights(DEFAULT, "logic", 100);
    expect(result).toEqual({ logic: 100, evidence: 0, persuasion: 0, originality: 0 });
  });

  it("handles setting a rubric to 0", () => {
    const result = redistributeWeights(DEFAULT, "logic", 0);
    const sum = result.logic + result.evidence + result.persuasion + result.originality;
    expect(sum).toBe(100);
    expect(result.logic).toBe(0);
  });

  it("clamps values above 100", () => {
    const result = redistributeWeights(DEFAULT, "logic", 150);
    expect(result.logic).toBe(100);
    const sum = result.logic + result.evidence + result.persuasion + result.originality;
    expect(sum).toBe(100);
  });

  it("clamps values below 0", () => {
    const result = redistributeWeights(DEFAULT, "logic", -10);
    expect(result.logic).toBe(0);
    const sum = result.logic + result.evidence + result.persuasion + result.originality;
    expect(sum).toBe(100);
  });

  it("handles when all other rubrics are zero (splits equally)", () => {
    const allOnLogic: Weights = { logic: 100, evidence: 0, persuasion: 0, originality: 0 };
    const result = redistributeWeights(allOnLogic, "logic", 40);
    expect(result.logic).toBe(40);
    const sum = result.logic + result.evidence + result.persuasion + result.originality;
    expect(sum).toBe(100);
    // Remaining 60 split among 3 rubrics: 20 each
    expect(result.evidence).toBe(20);
    expect(result.persuasion).toBe(20);
    expect(result.originality).toBe(20);
  });

  it("preserves proportions of non-changed rubrics", () => {
    const uneven: Weights = { logic: 40, evidence: 30, persuasion: 20, originality: 10 };
    const result = redistributeWeights(uneven, "logic", 60);
    // Others sum was 60, now should sum to 40
    // evidence: 30/60 * 40 = 20, persuasion: 20/60 * 40 ≈ 13, originality gets remainder
    expect(result.evidence + result.persuasion + result.originality).toBe(40);
  });

  it("rounds fractional values to integers", () => {
    const result = redistributeWeights(DEFAULT, "logic", 33);
    // All values should be integers
    expect(Number.isInteger(result.logic)).toBe(true);
    expect(Number.isInteger(result.evidence)).toBe(true);
    expect(Number.isInteger(result.persuasion)).toBe(true);
    expect(Number.isInteger(result.originality)).toBe(true);
    const sum = result.logic + result.evidence + result.persuasion + result.originality;
    expect(sum).toBe(100);
  });

  it("handles a no-op change (same value)", () => {
    const result = redistributeWeights(DEFAULT, "logic", 25);
    expect(result).toEqual(DEFAULT);
  });
});

describe("computeComposite", () => {
  it("computes weighted average with equal weights", () => {
    const scores: ScoreMap = { logic: 8, evidence: 6, persuasion: 4, originality: 2 };
    const result = computeComposite(scores, DEFAULT);
    // (8*25 + 6*25 + 4*25 + 2*25) / (25+25+25+25) = 500/100 = 5.0
    expect(result).toBe(5.0);
  });

  it("applies custom weights correctly", () => {
    const scores: ScoreMap = { logic: 10, evidence: 0, persuasion: 0, originality: 0 };
    const weights: Weights = { logic: 100, evidence: 0, persuasion: 0, originality: 0 };
    const result = computeComposite(scores, weights);
    // Only logic counts: 10*100 / 100 = 10
    expect(result).toBe(10);
  });

  it("ignores rubrics with missing scores", () => {
    const partial: ScoreMap = { logic: 8, evidence: 6 };
    const result = computeComposite(partial, DEFAULT);
    // Only logic and evidence: (8*25 + 6*25) / (25+25) = 350/50 = 7.0
    expect(result).toBe(7.0);
  });

  it("returns 0 when no scores exist", () => {
    const empty: ScoreMap = {};
    expect(computeComposite(empty, DEFAULT)).toBe(0);
  });

  it("returns 0 when all weights are 0 for scored rubrics", () => {
    const scores: ScoreMap = { logic: 8 };
    const zeroWeights: Weights = { logic: 0, evidence: 50, persuasion: 25, originality: 25 };
    expect(computeComposite(scores, zeroWeights)).toBe(0);
  });

  it("handles single-rubric-100% weight scenario", () => {
    const scores: ScoreMap = { logic: 9, evidence: 3, persuasion: 5, originality: 7 };
    const weights: Weights = { logic: 0, evidence: 0, persuasion: 100, originality: 0 };
    const result = computeComposite(scores, weights);
    expect(result).toBe(5);
  });
});
