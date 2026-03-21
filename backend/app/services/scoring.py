def compute_weighted_score(
    scores: dict[str, int | None],
    weights: dict[str, float],
) -> float | None:
    """Compute weighted average of scores, skipping None values.

    Returns None if no scores are present or all weights for present scores are zero.
    """
    numerator = 0.0
    denominator = 0.0

    for rubric, score in scores.items():
        if score is not None:
            weight = weights.get(rubric, 0.0)
            numerator += score * weight
            denominator += weight

    if denominator == 0:
        return None

    return numerator / denominator
