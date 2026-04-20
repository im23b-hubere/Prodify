from fastapi import APIRouter

from app.config import settings
from app.schemas import LegalDocumentMetaPublic, LegalDocumentsPublic

router = APIRouter(prefix="/legal", tags=["legal"])


@router.get("/documents", response_model=LegalDocumentsPublic)
def legal_documents():
    return LegalDocumentsPublic(
        privacy=LegalDocumentMetaPublic(
            title="Privacy Policy",
            version=settings.legal_version,
            effective_date=settings.legal_effective_date,
            url=settings.legal_privacy_url,
            in_app_path="/legal/privacy",
        ),
        terms=LegalDocumentMetaPublic(
            title="Terms of Use",
            version=settings.legal_version,
            effective_date=settings.legal_effective_date,
            url=settings.legal_terms_url,
            in_app_path="/legal/terms",
        ),
        support_email=settings.support_email,
    )
