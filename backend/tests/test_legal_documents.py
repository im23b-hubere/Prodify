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


def test_the_privacy_policy_explains_personalised_reminders(client):
    text = client.get("/legal/privacy").text

    assert "Personalised reminders" in text
    assert "uses your activity patterns to personalize reminders" in text
    assert "We do not use your location, WiFi, contacts or data from other apps" in text


def test_health_reports_release_version(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["version"] == "1.0.1"
