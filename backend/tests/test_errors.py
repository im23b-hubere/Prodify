from app.errors import _normalize_http_exception_detail


def test_normalize_http_exception_detail_list_validation():
    detail = [
        {"loc": ["body", "email"], "msg": "value is not a valid email", "type": "value_error.email"},
    ]
    message, code, extras = _normalize_http_exception_detail(detail, 422)
    assert code == "VALIDATION_ERROR"
    assert "email" in message
    assert "value is not a valid email" in message
    assert extras is not None
    assert extras.get("errors") == detail


def test_normalize_http_exception_detail_string():
    message, code, extras = _normalize_http_exception_detail("Not found", 404)
    assert message == "Not found"
    assert extras is None
    assert code == "ERROR_404"
