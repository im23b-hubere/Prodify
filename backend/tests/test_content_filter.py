import pytest

from app.services.content_filter import is_objectionable


@pytest.mark.parametrize(
    "text",
    [
        "fuck you",
        "You are a BITCH",
        "du hurensohn",
        "f u c k",
        "sh1t mix",
        "what a wichser",
    ],
)
def test_profanity_and_insults_are_objectionable(text):
    assert is_objectionable(text)


@pytest.mark.parametrize("username", ["xx_nigger_xx", "hitler88", "fuckboy99", "cunt.beats"])
def test_slurs_hidden_inside_usernames_are_objectionable(username):
    assert is_objectionable(username)


@pytest.mark.parametrize(
    "text",
    [
        "Great mix, the low end hits hard!",
        "Scunthorpe sessions",
        "classic bass",
        "assistant engineer",
        "Fagott sample in the intro",
        "Shiitake beats",
        "Schwanensee remix",
        "",
    ],
)
def test_ordinary_text_is_allowed(text):
    assert not is_objectionable(text)
