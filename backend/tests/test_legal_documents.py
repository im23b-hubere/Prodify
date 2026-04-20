def test_legal_documents_public_endpoint(client):
    response = client.get("/legal/documents")
    assert response.status_code == 200
    body = response.json()
    assert body["privacy"]["in_app_path"] == "/legal/privacy"
    assert body["terms"]["in_app_path"] == "/legal/terms"
    assert body["privacy"]["url"].startswith("https://")
    assert body["terms"]["url"].startswith("https://")
    assert "@" in body["support_email"]
