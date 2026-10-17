from html import escape

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.config import settings
from app.schemas import LegalDocumentMetaPublic, LegalDocumentsPublic

router = APIRouter(prefix="/legal", tags=["legal"])

PERSONALISATION_NOTICE = (
    "Prodify uses your activity patterns to personalize reminders and help you "
    "maintain your production routine."
)

PRIVACY_SECTIONS = (
    (
        "Controller",
        "Eric Huber (Zurich, Switzerland) is the controller for personal data processed "
        "in connection with Prodify. Contact: support@prodify.app.",
    ),
    (
        "Data we process",
        "We process account data (email, username, optional profile picture), "
        "authentication data when you use Sign in with Apple or Google, technical data "
        "needed to operate and secure the service, studio-session content you create "
        "(times, types, optional notes, mood and tags), streak and friendship data, "
        "comments and social activity, reports and blocks, subscription and entitlement "
        "status, push tokens when notifications are enabled, and crash/performance "
        "diagnostics.",
    ),
    (
        "Why we process it",
        "We use this data to provide the service, authenticate you, maintain account "
        "security, prevent abuse, moderate community content, process subscriptions, "
        "deliver notifications you have enabled, and keep the app reliable.",
    ),
    (
        "Legal bases",
        "Processing is necessary to perform the contract (GDPR Art. 6(1)(b)), to protect "
        "security and prevent abuse (legitimate interests, Art. 6(1)(f)), and — where you "
        "consented — for push messages (Art. 6(1)(a)).",
    ),
    (
        "Sign-in providers",
        "If you choose Sign in with Apple or Google, the provider verifies your identity "
        "and shares an identifier and, depending on your settings, your email address "
        "with Prodify so we can create or sign into your account. Apple and Google process "
        "data under their own privacy policies.",
    ),
    (
        "Personalised reminders",
        f"{PERSONALISATION_NOTICE} For this we only use first-party data from your use of "
        "Prodify: when and how long you produce, your streaks, challenges and friend "
        "activity on Prodify, and whether a reminder was opened or followed by a session. "
        "We do not use your location, WiFi, contacts or data from other apps, and we do "
        "not fingerprint your device. You can turn smart notifications or single "
        "categories off at any time in the notification settings.",
    ),
    (
        "Safety and moderation",
        "When you report or block someone, we store the report (reason, optional note, "
        "the reported user or comment, and your account) and the block. Moderators use "
        "reports and blocks only to review reports, remove violating content and suspend "
        "accounts. The reported user is never told who reported them.",
    ),
    (
        "Service providers",
        "We use specialized processors only as needed to operate Prodify: Render "
        "(hosting and PostgreSQL database, EU region where configured), Cloudflare R2 "
        "(profile picture storage), RevenueCat (subscription status and App Store "
        "purchase receipt validation), Apple and Google (sign-in and in-app purchases), "
        "Sentry (crash and performance diagnostics, with sensitive fields scrubbed), and "
        "Expo Push / platform push services (delivery of notifications you enable). "
        "These providers process data on our instructions and only for the stated "
        "purposes.",
    ),
    (
        "Retention and deletion",
        "We retain account data while your account exists. You can permanently delete "
        "your account in the app (Profile → Settings → Delete account). We remove "
        "associated personal data unless a legal retention obligation applies.",
    ),
    (
        "Your choices and rights",
        "You may request access, correction, deletion, restriction, portability, or "
        "object to eligible processing. Notification permission can be withdrawn in "
        "device settings. You may lodge a complaint with a supervisory authority.",
    ),
    (
        "Contact",
        "To exercise your rights or ask questions, email support@prodify.app.",
    ),
)

TERMS_SECTIONS = (
    (
        "Service",
        "Prodify helps users track studio sessions, streaks, goals, and optional social "
        "activity. Prodify requires an active subscription. Features and availability may "
        "evolve.",
    ),
    (
        "Account",
        "You are responsible for keeping your credentials secure and for content "
        "submitted through your account. Content must not violate applicable law or "
        "third-party rights.",
    ),
    (
        "Community guidelines",
        "Prodify has zero tolerance for objectionable content and abusive users. Do not "
        "post or send content that harasses, threatens or bullies others, promotes hate "
        "or discrimination, is sexual, violent or illegal, or is spam or impersonation. "
        "Comments containing prohibited language are filtered automatically.",
    ),
    (
        "Reporting and blocking",
        "You can report users and comments and block users directly in the app. We "
        "review every report within 24 hours, remove content that violates these terms, "
        "and suspend or permanently ban the accounts responsible. Blocked users can no "
        "longer find you, add you or see your activity.",
    ),
    (
        "Subscriptions",
        "Payment is charged to your Apple ID when a purchase is confirmed. Subscriptions "
        "renew automatically unless cancelled at least 24 hours before the current period "
        "ends. You can manage or cancel them in Apple ID subscription settings. Use "
        "Restore Purchases in Prodify after reinstalling or changing devices.",
    ),
    (
        "Availability",
        "We work to keep Prodify available and secure but cannot guarantee uninterrupted "
        "operation, including during maintenance or events outside our control.",
    ),
    (
        "Liability and changes",
        "Mandatory consumer rights remain unaffected. To the extent permitted by law, we "
        "are liable for intent and gross negligence; for slight negligence only for "
        "breaches of essential contractual duties and limited to typical, foreseeable "
        "damage. We may update these terms and will provide notice of material changes "
        "when required.",
    ),
    (
        "Contact",
        "Questions about these terms or a report: support@prodify.app. Provider details "
        "are in the Imprint.",
    ),
)


def _imprint_sections() -> tuple[tuple[str, str], ...]:
    name = settings.legal_operator_name.strip() or "Eric Huber"
    address = settings.legal_operator_address.strip() or "Zurich, Switzerland"
    email = settings.support_email.strip() or "support@prodify.app"
    return (
        (
            "Service provider",
            f"{name} operates the Prodify mobile application and related backend "
            "services as a sole proprietor.",
        ),
        (
            "Address",
            address,
        ),
        (
            "Contact",
            f"Email: {email}. For privacy rights requests use the same address.",
        ),
        (
            "Responsible for content",
            f"{name} is responsible for the content of this app and the associated "
            "support pages within the meaning of applicable identification rules "
            "(including Swiss UWG and, where relevant, German TMG).",
        ),
        (
            "Dispute resolution",
            "The European Commission provides a platform for online dispute resolution: "
            "https://ec.europa.eu/consumers/odr. We are not obliged and not willing to "
            "participate in dispute resolution proceedings before a consumer arbitration "
            "board.",
        ),
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
        imprint=LegalDocumentMetaPublic(
            title="Imprint",
            version=settings.legal_version,
            effective_date=settings.legal_effective_date,
            url=settings.legal_imprint_url,
            in_app_path="/legal/imprint",
        ),
        support_email=settings.support_email,
    )


@router.get("/privacy", response_class=HTMLResponse, include_in_schema=False)
def privacy_policy() -> HTMLResponse:
    return HTMLResponse(_legal_page("Privacy Policy", PRIVACY_SECTIONS))


@router.get("/terms", response_class=HTMLResponse, include_in_schema=False)
def terms_of_use() -> HTMLResponse:
    return HTMLResponse(_legal_page("Terms of Use", TERMS_SECTIONS))


@router.get("/imprint", response_class=HTMLResponse, include_in_schema=False)
def imprint() -> HTMLResponse:
    return HTMLResponse(_legal_page("Imprint", _imprint_sections()))


@router.get("/support", response_class=HTMLResponse, include_in_schema=False)
def support_page() -> HTMLResponse:
    return HTMLResponse(
        _legal_page(
            "Support",
            (
                (
                    "Contact",
                    f"Email {settings.support_email} for account, subscription, or "
                    "technical support. We usually reply within two business days.",
                ),
                (
                    "Account deletion",
                    "You can permanently delete your account and associated data from "
                    "Profile → Settings → Delete account inside the app.",
                ),
                (
                    "Subscriptions",
                    "Purchases and cancellations are managed through Apple ID "
                    "subscription settings. Use Restore Purchases in Prodify after "
                    "reinstalling or changing devices.",
                ),
                (
                    "Operator",
                    f"{settings.legal_operator_name} — {settings.legal_operator_address}. "
                    "Full details: /legal/imprint.",
                ),
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
