"""Seed the database with curated debate arguments and evaluate them.

Usage:
    uv run python -m scripts.seed                  # Full seed with evaluation
    uv run python -m scripts.seed --dry-run         # Preview without changes
    uv run python -m scripts.seed --reset           # Clear existing data first
    uv run python -m scripts.seed --skip-evaluation  # Insert without judging
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from sqlalchemy import delete, func, select

from app.database import async_session
from app.models import Argument, Score, Topic
from app.schemas import ArgumentStatus
from app.services.judge import evaluate_argument_all_judges

SEED_DATA_PATH = Path(__file__).parent.parent / "data" / "seed_arguments.json"

SEED_TOPIC_TITLE = "Should cities ban cars from downtown?"
SEED_TOPIC_DESCRIPTION = (
    "Consider environmental, economic, accessibility, and quality-of-life impacts. "
    "What's the strongest argument you can make for or against?"
)

DELAY_BETWEEN_ARGUMENTS = 2  # seconds, to respect API rate limits


async def get_or_create_topic(db) -> Topic:
    """Get the active topic or create the seed topic."""
    result = await db.execute(select(Topic).where(Topic.is_active.is_(True)))
    topic = result.scalar_one_or_none()

    if topic is not None:
        return topic

    topic = Topic(
        title=SEED_TOPIC_TITLE,
        description=SEED_TOPIC_DESCRIPTION,
    )
    db.add(topic)
    await db.flush()
    print(f"Created topic: {topic.title}")
    return topic


async def reset_data(db) -> None:
    """Delete all arguments and scores (cascades)."""
    result = await db.execute(select(func.count()).select_from(Argument))
    count = result.scalar_one()
    await db.execute(delete(Score))
    await db.execute(delete(Argument))
    await db.commit()
    print(f"Reset: deleted {count} arguments and their scores.")


async def seed(
    *,
    dry_run: bool = False,
    reset: bool = False,
    skip_evaluation: bool = False,
) -> None:
    """Load seed arguments, insert them, and optionally run judge evaluation."""
    # Load seed data
    if not SEED_DATA_PATH.exists():
        print(f"Error: seed data file not found at {SEED_DATA_PATH}")
        sys.exit(1)

    seed_args = json.loads(SEED_DATA_PATH.read_text())
    print(f"Loaded {len(seed_args)} seed arguments from {SEED_DATA_PATH.name}")

    if dry_run:
        print("\n--- DRY RUN (no changes will be made) ---\n")
        for i, arg_data in enumerate(seed_args, 1):
            body_preview = arg_data["body"][:80].replace("\n", " ")
            author = arg_data.get("author_name", "Anonymous")
            print(f"  {i:2d}. [{author}] {body_preview}...")
        print(f"\nWould insert {len(seed_args)} arguments and evaluate with 4 judges each.")
        if not skip_evaluation:
            est_time = len(seed_args) * (10 + DELAY_BETWEEN_ARGUMENTS)
            print(f"Estimated time: ~{est_time // 60}m {est_time % 60}s")
        return

    async with async_session() as db:
        if reset:
            await reset_data(db)

        topic = await get_or_create_topic(db)
        print(f"Using topic: {topic.title} (id={topic.id})\n")

        scored_count = 0
        partial_count = 0
        failed_count = 0
        rubric_scores: dict[str, list[int]] = {
            "logic": [],
            "evidence": [],
            "persuasion": [],
            "originality": [],
        }

        for i, arg_data in enumerate(seed_args, 1):
            body_preview = arg_data["body"][:60].replace("\n", " ")
            author = arg_data.get("author_name", "Anonymous")
            print(f"[{i:2d}/{len(seed_args)}] {author}: {body_preview}...")

            argument = Argument(
                topic_id=topic.id,
                body=arg_data["body"],
                author_name=arg_data.get("author_name"),
            )
            db.add(argument)
            await db.flush()

            if skip_evaluation:
                print("       → Skipped evaluation")
            else:
                results = await evaluate_argument_all_judges(
                    argument_id=argument.id,
                    argument_body=argument.body,
                    topic_title=topic.title,
                    db=db,
                )

                await db.refresh(argument)
                status_icon = {
                    "scored": "✅",
                    "partial": "⚠️",
                    "failed": "❌",
                }.get(argument.status, "?")

                print(f"       → {status_icon} {argument.status}", end="")
                if argument.composite_score is not None:
                    print(f" (composite: {argument.composite_score:.1f})", end="")
                print()

                # Print individual rubric scores
                for rubric_name, result in results.items():
                    if isinstance(result, Exception):
                        print(f"         {rubric_name}: FAILED ({result})")
                    else:
                        print(f"         {rubric_name}: {result.score}/10")
                        rubric_scores[rubric_name].append(result.score)

                # Track status counts
                if argument.status == ArgumentStatus.SCORED:
                    scored_count += 1
                elif argument.status == ArgumentStatus.PARTIAL:
                    partial_count += 1
                else:
                    failed_count += 1

            # Delay between arguments to respect API rate limits
            if not skip_evaluation and i < len(seed_args):
                await asyncio.sleep(DELAY_BETWEEN_ARGUMENTS)

        await db.commit()

        # Summary
        print("\n" + "=" * 60)
        print("SEED SUMMARY")
        print("=" * 60)
        print(f"Total arguments: {len(seed_args)}")

        if not skip_evaluation:
            print(f"Scored: {scored_count}  |  Partial: {partial_count}  |  Failed: {failed_count}")
            print()
            print("Score ranges by rubric:")
            for rubric, scores in rubric_scores.items():
                if scores:
                    print(
                        f"  {rubric:12s}: "
                        f"min={min(scores):2d}  max={max(scores):2d}  "
                        f"avg={sum(scores) / len(scores):.1f}  "
                        f"range={max(scores) - min(scores)}"
                    )
                else:
                    print(f"  {rubric:12s}: no scores")
        else:
            print("Evaluation skipped — arguments inserted with status 'pending'")

        print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Seed DebateRank with curated arguments")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be seeded without making changes",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete all existing arguments and scores before seeding",
    )
    parser.add_argument(
        "--skip-evaluation",
        action="store_true",
        help="Insert arguments without running judge evaluation",
    )
    args = parser.parse_args()

    asyncio.run(seed(dry_run=args.dry_run, reset=args.reset, skip_evaluation=args.skip_evaluation))


if __name__ == "__main__":
    main()
