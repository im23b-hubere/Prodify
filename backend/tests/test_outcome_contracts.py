from app.contracts.outcomes import GoalForecastPublic as GoalForecastContract
from app.contracts.outcomes import ProgressionPublic as ProgressionContract
from app.schemas import GoalForecastPublic, ProgressionPublic


def test_legacy_schema_exports_reference_outcome_contracts():
    assert GoalForecastPublic is GoalForecastContract
    assert ProgressionPublic is ProgressionContract


def test_progression_contract_keeps_decay_defaults():
    progression = ProgressionContract(
        xp_total=120,
        current_level=3,
        xp_to_next_level=30,
        progress_percent=75,
    )

    assert progression.decay_grace_days == 2
    assert progression.decay_xp_per_day == 12
