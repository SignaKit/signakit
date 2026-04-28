"""Bot detection tests."""

from __future__ import annotations

import pytest

from signakit_flags.bot_patterns import is_bot


@pytest.mark.parametrize(
    "ua",
    [
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "GPTBot/1.0",
        "ClaudeBot",
        "facebookexternalhit/1.1",
        "Twitterbot/1.0",
        "curl/7.68.0",
        "python-requests/2.31",
    ],
)
def test_known_bots_match(ua: str) -> None:
    assert is_bot(ua) is True


@pytest.mark.parametrize(
    "ua",
    [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile Safari",
    ],
)
def test_real_user_agents_do_not_match(ua: str) -> None:
    assert is_bot(ua) is False


def test_none_and_empty() -> None:
    assert is_bot(None) is False
    assert is_bot("") is False
