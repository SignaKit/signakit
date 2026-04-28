"""Config manager / SDK key tests."""

from __future__ import annotations

import pytest

from signakit_flags.config_manager import ConfigManager, parse_sdk_key


def test_parse_sdk_key_dev() -> None:
    parsed = parse_sdk_key("sk_dev_orgA_proj1_abcdef")
    assert parsed.org_id == "orgA"
    assert parsed.project_id == "proj1"
    assert parsed.environment == "development"


def test_parse_sdk_key_prod() -> None:
    parsed = parse_sdk_key("sk_prod_orgA_proj1_abcdef")
    assert parsed.environment == "production"


def test_parse_sdk_key_invalid_prefix() -> None:
    with pytest.raises(ValueError):
        parse_sdk_key("xx_dev_o_p_random")


def test_parse_sdk_key_invalid_env() -> None:
    with pytest.raises(ValueError):
        parse_sdk_key("sk_staging_o_p_random")


def test_parse_sdk_key_too_few_parts() -> None:
    with pytest.raises(ValueError):
        parse_sdk_key("sk_dev_only")


def test_config_url_format() -> None:
    cm = ConfigManager(org_id="orgA", project_id="proj1", environment="production")
    assert (
        cm.config_url
        == "https://d30l2rkped5b4m.cloudfront.net/configs/orgA/proj1/production/latest.json"
    )


def test_config_url_strips_trailing_slash() -> None:
    cm = ConfigManager(
        org_id="o", project_id="p", environment="development", cdn_url="https://cdn.test/"
    )
    assert cm.config_url == "https://cdn.test/configs/o/p/development/latest.json"
