"""Keeps obvious profanity, insults and slurs out of user-visible text (App Review Guideline 1.2).

This is a first line of defence, not moderation: reports and moderators handle everything else.
"""

import re

_LEET_SUBSTITUTIONS = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s"})

# Rejected only as a whole word, because they also occur inside harmless words ("Scunthorpe", "Fagott").
_BLOCKED_WORDS = frozenset(
    {
        "asshole",
        "bastard",
        "bitch",
        "bitches",
        "chink",
        "cunt",
        "dick",
        "fag",
        "kike",
        "pussy",
        "retard",
        "shit",
        "slut",
        "spic",
        "whore",
        "arschloch",
        "fotze",
        "hure",
        "missgeburt",
        "neger",
        "schlampe",
        "schwanz",
        "spast",
        "nazi",
    }
)

# Rejected anywhere, so they are also caught inside usernames like "fuckboy99".
_BLOCKED_FRAGMENTS = (
    "fuck",
    "nigger",
    "nigga",
    "faggot",
    "hitler",
    "hurensohn",
    "kanake",
    "schwuchtel",
    "wichser",
)


class ObjectionableContentError(Exception):
    """Text other people would read uses language the community guidelines forbid."""


def reject_objectionable(*texts: str | None) -> None:
    """Guards every text another producer can read: comments, challenge titles, shared session details."""
    if any(text and is_objectionable(text) for text in texts):
        raise ObjectionableContentError


def is_objectionable(text: str) -> bool:
    words = _words(text)
    if any(word in _BLOCKED_WORDS for word in words):
        return True
    return any(fragment in word for word in words for fragment in _BLOCKED_FRAGMENTS)


def _words(text: str) -> list[str]:
    tokens = re.findall(r"[a-zäöüß]+", text.lower().translate(_LEET_SUBSTITUTIONS))
    return [*tokens, *_spelled_out_words(tokens)]


def _spelled_out_words(tokens: list[str]) -> list[str]:
    """Joins runs of single letters, so "f u c k" is read as "fuck"."""
    joined: list[str] = []
    run = ""
    for token in [*tokens, ""]:
        if len(token) == 1:
            run += token
            continue
        if len(run) > 1:
            joined.append(run)
        run = ""
    return joined
