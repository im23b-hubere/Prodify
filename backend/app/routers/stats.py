from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_kpi_admin
from app.models import User
from app.schemas import (
    HeatmapPublic,
    KpiDashboardPublic,
    KpiSummaryPublic,
    PersonalRecordsPublic,
    StatsInsightsPublic,
)
from app.services.kpi_tracker import kpi_dashboard, kpi_summary
from app.services.stats_service import build_heatmap, build_personal_records, build_stats_insights

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/insights", response_model=StatsInsightsPublic)
def stats_insights(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> StatsInsightsPublic:
    return build_stats_insights(db, current.id)


@router.get("/records", response_model=PersonalRecordsPublic)
def stats_records(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> PersonalRecordsPublic:
    return build_personal_records(db, current.id)


@router.get("/heatmap", response_model=HeatmapPublic)
def stats_heatmap(
    current: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> HeatmapPublic:
    return build_heatmap(db, current.id)


@router.get("/kpi/summary", response_model=KpiSummaryPublic)
def stats_kpi_summary(
    _current: Annotated[User, Depends(require_kpi_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> KpiSummaryPublic:
    return kpi_summary(db)


@router.get("/kpi/dashboard", response_model=KpiDashboardPublic)
def stats_kpi_dashboard(
    _current: Annotated[User, Depends(require_kpi_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> KpiDashboardPublic:
    return kpi_dashboard(db, window_days=7)
