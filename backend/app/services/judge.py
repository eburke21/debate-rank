import asyncio
import logging
import time
from datetime import UTC, datetime
from uuid import UUID

from anthropic import AsyncAnthropic
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Argument, Score
from app.schemas import ArgumentStatus, JudgeOutput

logger = logging.getLogger(__name__)

JUDGE_MODEL = "claude-sonnet-4-20250514"
JUDGE_TIMEOUT_SECONDS = 30

JUDGE_RUBRICS: dict[str, dict] = {
    "logic": {
        "name": "Logical Rigor",
        "icon": "🔬",
        "system_prompt": (
            "You are a judge evaluating arguments on LOGICAL RIGOR ONLY.\n\n"
            "Score 1-10 on these sub-criteria:\n"
            "- Premise validity: Are the stated or implied premises true "
            "and defensible? (0-3 pts)\n"
            "- Inferential strength: Do the conclusions follow from the premises? (0-3 pts)\n"
            "- Absence of fallacies: Is the argument free from logical fallacies? (0-2 pts)\n"
            "- Internal consistency: Are all claims compatible with each other? (0-2 pts)\n\n"
            "IMPORTANT: Ignore emotional appeal, writing quality, and rhetorical technique. "
            "A dry, poorly-written argument with perfect logic should score 9-10. "
            "A beautifully-written argument with a hidden false dichotomy should score low.\n\n"
            "Use the FULL range: 1-2 = deeply flawed logic, 5-6 = some valid reasoning with "
            "notable gaps, 9-10 = near-flawless reasoning."
        ),
    },
    "evidence": {
        "name": "Evidence Quality",
        "icon": "📊",
        "system_prompt": (
            "You are a judge evaluating arguments on EVIDENCE QUALITY ONLY.\n\n"
            "Score 1-10 on these sub-criteria:\n"
            "- Specificity: Does the argument cite specific data, studies, or examples? (0-3 pts)\n"
            "- Source quality: Are cited sources credible and authoritative? (0-3 pts)\n"
            "- Relevance: Is the evidence directly relevant to the claim? (0-2 pts)\n"
            "- Sufficiency: Is there enough evidence to support the scope "
            "of the claim? (0-2 pts)\n\n"
            "IMPORTANT: An argument can be logically valid but evidence-free (score low). "
            "An argument with excellent citations but a flawed conclusion should still score high "
            "HERE. You are judging the evidence, not the reasoning.\n\n"
            "Use the FULL range: 1-2 = pure opinion/assertion, 5-6 = some evidence but gaps, "
            "9-10 = thoroughly sourced."
        ),
    },
    "persuasion": {
        "name": "Persuasiveness",
        "icon": "🎭",
        "system_prompt": (
            "You are a judge evaluating arguments on PERSUASIVENESS ONLY.\n\n"
            "Score 1-10 on these sub-criteria:\n"
            "- Emotional resonance: Does the argument connect with the reader's values/emotions? "
            "(0-3 pts)\n"
            "- Rhetorical technique: Does it use effective framing, analogy, narrative, contrast? "
            "(0-3 pts)\n"
            "- Audience awareness: Is the tone and vocabulary appropriate for a general audience? "
            "(0-2 pts)\n"
            "- Memorability: Would you remember this argument tomorrow? (0-2 pts)\n\n"
            "IMPORTANT: Logical validity is IRRELEVANT here. A vivid personal anecdote with no "
            "data can score 10 if it would genuinely change minds. A dry statistical analysis "
            "with perfect logic can score 3 if nobody would read past the first sentence.\n\n"
            "Use the FULL range: 1-2 = dry/forgettable, 5-6 = competent but unremarkable, "
            "9-10 = genuinely compelling."
        ),
    },
    "originality": {
        "name": "Originality",
        "icon": "💡",
        "system_prompt": (
            "You are a judge evaluating arguments on ORIGINALITY ONLY.\n\n"
            "Score 1-10 on these sub-criteria:\n"
            "- Novel framing: Does the argument approach the topic from an unexpected angle? "
            "(0-3 pts)\n"
            "- Insight depth: Does it reveal something non-obvious about the issue? (0-3 pts)\n"
            "- Beyond conventional wisdom: Does it go beyond what most people already think? "
            "(0-2 pts)\n"
            "- Creative synthesis: Does it connect ideas from different domains? (0-2 pts)\n\n"
            "IMPORTANT: A perfectly logical, well-evidenced argument that says what everyone "
            "already knows should score LOW here. An argument that makes you think 'huh, I never "
            "considered that angle' should score HIGH even if the evidence is thin.\n\n"
            "Use the FULL range: 1-2 = pure conventional wisdom, 5-6 = some fresh elements, "
            "9-10 = genuinely novel perspective."
        ),
    },
}

EVALUATION_USER_PROMPT = (
    'Evaluate the following argument submitted to the debate topic: "{topic}"\n\n'
    "---\n"
    "ARGUMENT:\n"
    "{argument}\n"
    "---\n\n"
    "Respond with ONLY a JSON object (no markdown, no preamble):\n"
    '{{"score": <integer 1-10>, "rationale": "<your detailed rationale, 100-300 words>"}}'
)


async def evaluate_single_judge(
    argument_body: str,
    topic_title: str,
    rubric_name: str,
    client: AsyncAnthropic | None = None,
) -> tuple[JudgeOutput, int]:
    """Evaluate an argument with a single judge. Retries once on parse failure.

    Returns (JudgeOutput, latency_ms).
    """
    if client is None:
        client = AsyncAnthropic()

    rubric = JUDGE_RUBRICS[rubric_name]
    user_content = EVALUATION_USER_PROMPT.format(
        topic=topic_title,
        argument=argument_body,
    )

    start = time.monotonic()

    for attempt in range(2):
        response = await asyncio.wait_for(
            client.messages.create(
                model=JUDGE_MODEL,
                max_tokens=512,
                system=rubric["system_prompt"],
                messages=[{"role": "user", "content": user_content}],
            ),
            timeout=JUDGE_TIMEOUT_SECONDS,
        )
        raw_text = response.content[0].text.strip()

        try:
            result = JudgeOutput.model_validate_json(raw_text)
            latency_ms = int((time.monotonic() - start) * 1000)
            return result, latency_ms
        except Exception as e:
            if attempt == 0:
                user_content = (
                    f"Your previous response was not valid JSON: {e}\n"
                    f"Original response: {raw_text}\n\n"
                    "Please respond with ONLY a valid JSON object: "
                    '{"score": <integer 1-10>, "rationale": "<string>"}'
                )
            else:
                raise ValueError(
                    f"Judge {rubric_name} failed to produce valid JSON after retry"
                ) from e

    # Should never reach here, but satisfy type checker
    raise ValueError(f"Judge {rubric_name} failed unexpectedly")  # pragma: no cover


async def evaluate_argument_all_judges(
    argument_id: UUID,
    argument_body: str,
    topic_title: str,
    db: AsyncSession,
) -> dict[str, JudgeOutput | Exception]:
    """Dispatch all 4 judges in parallel. Persists scores and updates argument status."""
    rubric_names = list(JUDGE_RUBRICS.keys())

    tasks = [evaluate_single_judge(argument_body, topic_title, rubric) for rubric in rubric_names]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    output: dict[str, JudgeOutput | Exception] = {}
    for rubric_name, result in zip(rubric_names, results):
        if isinstance(result, Exception):
            output[rubric_name] = result
            logger.error("Judge %s failed for argument %s: %s", rubric_name, argument_id, result)
        else:
            judge_output, latency_ms = result
            output[rubric_name] = judge_output
            score_row = Score(
                argument_id=argument_id,
                rubric=rubric_name,
                score=judge_output.score,
                rationale=judge_output.rationale,
                model_id=JUDGE_MODEL,
                latency_ms=latency_ms,
            )
            db.add(score_row)

    # Determine final status
    successes = {k: v for k, v in output.items() if isinstance(v, JudgeOutput)}
    if len(successes) == 4:
        status = ArgumentStatus.SCORED
        composite = sum(v.score for v in successes.values()) / 4
    elif len(successes) >= 2:
        status = ArgumentStatus.PARTIAL
        composite = sum(v.score for v in successes.values()) / len(successes)
    else:
        status = ArgumentStatus.FAILED
        composite = None

    # Update argument
    argument = await db.get(Argument, argument_id)
    if argument is not None:
        argument.status = status
        argument.composite_score = composite
        if status in (ArgumentStatus.SCORED, ArgumentStatus.PARTIAL):
            argument.scored_at = datetime.now(UTC)
        await db.commit()

    return output
