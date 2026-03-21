from app.services.scoring import compute_weighted_score

EQUAL_WEIGHTS = {"logic": 25, "evidence": 25, "persuasion": 25, "originality": 25}


class TestComputeWeightedScore:
    def test_equal_weights(self):
        scores = {"logic": 8, "evidence": 6, "persuasion": 7, "originality": 5}
        result = compute_weighted_score(scores, EQUAL_WEIGHTS)
        assert result == 6.5

    def test_single_rubric_weight(self):
        """100% weight on logic → returns logic score."""
        scores = {"logic": 8, "evidence": 6, "persuasion": 7, "originality": 5}
        weights = {"logic": 100, "evidence": 0, "persuasion": 0, "originality": 0}
        result = compute_weighted_score(scores, weights)
        assert result == 8.0

    def test_partial_scores(self):
        """Only 2 of 4 rubrics present → average of those 2."""
        scores = {"logic": 8, "evidence": None, "persuasion": 6, "originality": None}
        result = compute_weighted_score(scores, EQUAL_WEIGHTS)
        assert result == 7.0

    def test_all_none_returns_none(self):
        scores = {"logic": None, "evidence": None, "persuasion": None, "originality": None}
        result = compute_weighted_score(scores, EQUAL_WEIGHTS)
        assert result is None

    def test_zero_weights_returns_none(self):
        """All weights are zero → returns None (division by zero guard)."""
        scores = {"logic": 8, "evidence": 6, "persuasion": 7, "originality": 5}
        weights = {"logic": 0, "evidence": 0, "persuasion": 0, "originality": 0}
        result = compute_weighted_score(scores, weights)
        assert result is None

    def test_unequal_weights(self):
        """Heavy weight on logic (75%) vs others (equal remainder)."""
        scores = {"logic": 10, "evidence": 2, "persuasion": 2, "originality": 2}
        third = 25.0 / 3
        weights = {"logic": 75, "evidence": third, "persuasion": third, "originality": third}
        result = compute_weighted_score(scores, weights)
        # 10*75 + 2*(25/3)*3 = 750 + 50 = 800; /100 = 8.0
        assert result == 8.0
