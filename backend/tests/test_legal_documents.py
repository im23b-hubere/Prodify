def test_legal_documents_public_endpoint(client):
    response = client.get("/legal/documents")
    assert response.status_code == 200
    body = response.json()
    assert body["privacy"]["in_app_path"] == "/legal/privacy"
    assert body["terms"]["in_app_path"] == "/legal/terms"
    assert body["imprint"]["in_app_path"] == "/legal/imprint"
    assert body["privacy"]["url"].startswith("https://")
    assert body["terms"]["url"].startswith("https://")
    assert body["imprint"]["url"].startswith("https://")
    assert "@" in body["support_email"]


def test_public_legal_pages_are_renderable_html(client):
    for path, heading in (
        ("/legal/privacy", "Privacy Policy"),
        ("/legal/terms", "Terms of Use"),
        ("/legal/imprint", "Imprint"),
        ("/legal/support", "Support"),
    ):
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/html")
        assert heading in response.text
        assert "mailto:" in response.text


def test_imprint_names_the_operator(client):
    text = client.get("/legal/imprint").text

    assert "Eric Huber" in text
    assert "Switzerland" in text
    assert "support@prodify.app" in text


def test_privacy_policy_names_processors_and_sign_in_providers(client):
    text = client.get("/legal/privacy").text

    assert "Sign in with Apple" in text
    assert "Google" in text
    assert "RevenueCat" in text
    assert "Sentry" in text
    assert "Cloudflare" in text
    assert "Render" in text
    assert "Expo" in text


def test_the_privacy_policy_explains_personalised_reminders(client):
    text = client.get("/legal/privacy").text

    assert "Personalised reminders" in text
    assert "uses your activity patterns to personalize reminders" in text
    assert "We do not use your location, WiFi, contacts or data from other apps" in text


def test_terms_commit_to_zero_tolerance_for_objectionable_content(client):
    terms = client.get("/legal/terms").text

    assert "Community guidelines" in terms
    assert "zero tolerance" in terms


def test_terms_explain_reporting_blocking_and_review_deadline(client):
    terms = client.get("/legal/terms").text

    assert "Reporting and blocking" in terms
    assert "within 24 hours" in terms
    assert "suspend" in terms


def test_privacy_policy_covers_safety_reports(client):
    privacy = client.get("/legal/privacy").text

    assert "reports" in privacy
    assert "blocks" in privacy


def test_health_reports_release_version(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["version"] == "1.0.1"
