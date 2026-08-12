from app.contracts.insights import HeatmapDayPublic as HeatmapDayContract
from app.contracts.insights import SessionDetailInsightsPublic as SessionDetailInsightsContract
from app.contracts.insights import StreakOverviewPublic as StreakOverviewContract
from app.schemas import HeatmapDayPublic, SessionDetailInsightsPublic, StreakOverviewPublic


def test_legacy_schema_exports_reference_insight_contracts():
    assert HeatmapDayPublic is HeatmapDayContract
    assert SessionDetailInsightsPublic is SessionDetailInsightsContract
    assert StreakOverviewPublic is StreakOverviewContract


def test_heatmap_contract_keeps_numeric_intensity():
    day = HeatmapDayContract(date="2026-08-12", seconds=900, intensity=2)

    assert day.model_dump() == {"date": "2026-08-12", "seconds": 900, "intensity": 2}
