from fastapi import APIRouter

from app.config import feature_flags_snapshot
from app.schemas import FeatureFlagsPublic

router = APIRouter(prefix="/feature-flags", tags=["feature-flags"])


@router.get("", response_model=FeatureFlagsPublic)
def get_feature_flags():
    return FeatureFlagsPublic(**feature_flags_snapshot())
