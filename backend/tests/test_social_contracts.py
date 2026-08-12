import pytest

from app.contracts.social import CheckinLogBody as CheckinLogContract
from app.contracts.social import SocialCommentBody as SocialCommentContract
from app.contracts.social import SocialReactionBody as SocialReactionContract
from app.schemas import CheckinLogBody, SocialCommentBody, SocialReactionBody


def test_legacy_schema_exports_reference_social_contracts():
    assert CheckinLogBody is CheckinLogContract
    assert SocialCommentBody is SocialCommentContract
    assert SocialReactionBody is SocialReactionContract


def test_social_contracts_normalize_user_text():
    assert CheckinLogContract(note="  shipped   a draft ").note == "shipped a draft"
    assert SocialCommentContract(body="  great   work ").body == "great work"


def test_social_comment_rejects_whitespace_only_body():
    with pytest.raises(ValueError, match="body must not be empty"):
        SocialCommentContract(body="   ")


def test_social_reaction_preserves_thumb_default():
    assert SocialReactionContract().emoji == "\U0001F44D"
    assert SocialReactionContract(emoji=" ").emoji == "\U0001F44D"
