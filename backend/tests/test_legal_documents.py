def test_legal_documents_public_endpoint(client):
    response = client.get("/legal/documents")
    assert response.status_code == 200
    body = response.json()
    assert body["privacy"]["in_app_path"] == "/legal/privacy"
    assert body["terms"]["in_app_path"] == "/legal/terms"
    assert body["privacy"]["url"].startswith("https://")
    assert body["terms"]["url"].startswith("https://")
    assert "@" in body["support_email"]


def test_public_legal_pages_are_renderable_html(client):
    for path, heading in (
        ("/legal/privacy", "Privacy Policy"),
        ("/legal/terms", "Terms of Use"),
        ("/legal/support", "Support"),
    ):
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/html")
        assert heading in response.text
        assert "mailto:" in response.text


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
