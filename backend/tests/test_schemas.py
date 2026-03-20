import pytest
from pydantic import ValidationError

from app.schemas import ArgumentCreate, ArgumentStatus, JudgeOutput, Rubric


class TestRubricEnum:
    def test_has_exactly_four_values(self):
        assert len(Rubric) == 4

    def test_values(self):
        assert set(Rubric) == {"logic", "evidence", "persuasion", "originality"}


class TestArgumentStatusEnum:
    def test_has_exactly_five_values(self):
        assert len(ArgumentStatus) == 5

    def test_values(self):
        expected = {"pending", "scoring", "scored", "partial", "failed"}
        assert set(ArgumentStatus) == expected


class TestArgumentCreate:
    def test_accepts_50_char_body(self):
        arg = ArgumentCreate(body="x" * 50)
        assert len(arg.body) == 50

    def test_rejects_49_char_body(self):
        with pytest.raises(ValidationError):
            ArgumentCreate(body="x" * 49)

    def test_accepts_2000_char_body(self):
        arg = ArgumentCreate(body="x" * 2000)
        assert len(arg.body) == 2000

    def test_rejects_2001_char_body(self):
        with pytest.raises(ValidationError):
            ArgumentCreate(body="x" * 2001)

    def test_author_name_optional(self):
        arg = ArgumentCreate(body="x" * 50)
        assert arg.author_name is None

    def test_author_name_max_length(self):
        with pytest.raises(ValidationError):
            ArgumentCreate(body="x" * 50, author_name="a" * 101)


class TestJudgeOutput:
    def test_accepts_score_1(self):
        output = JudgeOutput(score=1, rationale="Weak argument.")
        assert output.score == 1

    def test_accepts_score_10(self):
        output = JudgeOutput(score=10, rationale="Excellent argument.")
        assert output.score == 10

    def test_rejects_score_0(self):
        with pytest.raises(ValidationError):
            JudgeOutput(score=0, rationale="Invalid.")

    def test_rejects_score_11(self):
        with pytest.raises(ValidationError):
            JudgeOutput(score=11, rationale="Invalid.")

    def test_model_validate_json_valid(self):
        json_str = '{"score": 7, "rationale": "Solid reasoning."}'
        output = JudgeOutput.model_validate_json(json_str)
        assert output.score == 7
        assert output.rationale == "Solid reasoning."

    def test_model_validate_json_invalid(self):
        with pytest.raises(ValidationError):
            JudgeOutput.model_validate_json('{"score": "not_a_number"}')

    def test_rationale_max_length(self):
        with pytest.raises(ValidationError):
            JudgeOutput(score=5, rationale="x" * 2001)
