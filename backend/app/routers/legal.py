from html import escape

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.config import settings
from app.schemas import LegalDocumentMetaPublic, LegalDocumentsPublic

router = APIRouter(prefix="/legal", tags=["legal"])

PRIVACY_SECTIONS = (
    ("Data we process", "We process account data, technical data needed to operate and secure the service, studio-session content you create, streak and friendship data, subscription status, and push tokens when notifications are enabled."),
    ("Why we process it", "We use this data to provide the service, maintain account security, prevent abuse, process subscriptions, and send notifications you have enabled."),
    ("Retention and deletion", "We retain account data while your account exists. You can permanently delete your account in the app. We remove associated personal data unless a legal retention obligation applies."),
    ("Your choices and rights", "You may request access, correction, deletion, restriction, portability, or object to eligible processing. Notification permission can be withdrawn in device settings."),
    ("Service providers", "Prodify uses infrastructure, crash-reporting, push-notification, and subscription providers only as needed to operate the service."),
)

TERMS_SECTIONS = (
    ("Service", "Prodify helps users track studio sessions, streaks, goals, and optional social activity. Features and availability may evolve."),
    ("Account", "You are responsible for keeping your credentials secure and for content submitted through your account. Content must not violate applicable law or third-party rights."),
    ("Subscriptions", "Payment is charged to your Apple ID when a purchase is confirmed. Subscriptions renew automatically unless cancelled at least 24 hours before the current period ends. You can manage or cancel them in Apple ID subscription settings."),
    ("Availability", "We work to keep Prodify available and secure but cannot guarantee uninterrupted operation, including during maintenance or events outside our control."),
    ("Liability and changes", "Mandatory consumer rights remain unaffected. We may update these terms and will provide notice of material changes when required."),
)


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


@router.get("/privacy", response_class=HTMLResponse, include_in_schema=False)
def privacy_policy() -> HTMLResponse:
    return HTMLResponse(_legal_page("Privacy Policy", PRIVACY_SECTIONS))


@router.get("/terms", response_class=HTMLResponse, include_in_schema=False)
def terms_of_use() -> HTMLResponse:
    return HTMLResponse(_legal_page("Terms of Use", TERMS_SECTIONS))


@router.get("/support", response_class=HTMLResponse, include_in_schema=False)
def support_page() -> HTMLResponse:
    return HTMLResponse(
        _legal_page(
            "Support",
            (
                ("Contact", f"Email {settings.support_email} for account, subscription, or technical support."),
                ("Account deletion", "You can permanently delete your account and associated data from Profile → Delete account inside the app."),
                ("Subscriptions", "Purchases and cancellations are managed through Apple ID subscription settings. Use Restore Purchases in Prodify after reinstalling or changing devices."),
            ),
        )
    )


def _legal_page(title: str, sections: tuple[tuple[str, str], ...]) -> str:
    section_html = "".join(
        f"<section><h2>{escape(heading)}</h2><p>{escape(body)}</p></section>"
        for heading, body in sections
    )
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)} · Prodify</title>
<style>body{{background:#0a0a0a;color:#f5f5f5;font:16px/1.6 system-ui,sans-serif;margin:0}}main{{max-width:760px;margin:auto;padding:40px 24px}}h1,h2{{line-height:1.2}}h2{{margin-top:32px}}p,footer{{color:#c7c7c7}}a{{color:#9fd5ff}}</style></head>
<body><main><h1>{escape(title)}</h1><p>Effective {escape(settings.legal_effective_date)} · Version {escape(settings.legal_version)}</p>
{section_html}<footer><p>Questions or rights requests: <a href="mailto:{escape(settings.support_email)}">{escape(settings.support_email)}</a></p></footer>
</main></body></html>"""
