"""SignaKit Flags — Python SDK.

Official Python SDK for SignaKit Feature Flags. Fetches configuration from
CloudFront/S3 and evaluates flags locally with consistent bucketing across
languages.
"""

from __future__ import annotations

from .bot_patterns import is_bot
from .client import SignaKitClient, create_instance
from .config_manager import ConfigManager, parse_sdk_key
from .constants import (
    BUCKET_SPACE,
    SIGNAKIT_CDN_URL,
    SIGNAKIT_EVENTS_URL,
)
from .types import (
    Decision,
    Decisions,
    OnReadyResult,
    TrackEventOptions,
    UserAttributes,
    VariableValue,
)
from .user_context import SignaKitUserContext

__all__ = [
    "BUCKET_SPACE",
    "ConfigManager",
    "Decision",
    "Decisions",
    "OnReadyResult",
    "SIGNAKIT_CDN_URL",
    "SIGNAKIT_EVENTS_URL",
    "SignaKitClient",
    "SignaKitUserContext",
    "TrackEventOptions",
    "UserAttributes",
    "VariableValue",
    "create_instance",
    "is_bot",
    "parse_sdk_key",
]
__version__ = "0.1.0"
