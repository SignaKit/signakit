"""User context — created via :class:`SignaKitClient.create_user_context`."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from .bot_patterns import is_bot
from .constants import (
    MAX_ATTRIBUTE_KEY_LENGTH,
    MAX_ATTRIBUTE_VALUE_LENGTH,
    MAX_ATTRIBUTES_COUNT,
    MAX_EVENT_KEY_LENGTH,
    MAX_METADATA_SIZE_BYTES,
    MAX_USER_ID_LENGTH,
)
from .types import (
    Decision,
    Decisions,
    TrackEventOptions,
    UserAttributes,
)

if TYPE_CHECKING:
    from .client import SignaKitClient

_logger = logging.getLogger(__name__)


def _sanitize_attributes(
    attributes: UserAttributes | None,
) -> UserAttributes | None:
    """Truncate keys/values and cap attribute count, mirroring the JS SDK."""
    if not attributes:
        return None

    sanitized: UserAttributes = {}
    for key in list(attributes.keys())[:MAX_ATTRIBUTES_COUNT]:
        value = attributes[key]
        if value is None:  # pragma: no cover — defensive
            continue
        truncated_key = key[:MAX_ATTRIBUTE_KEY_LENGTH]
        if isinstance(value, str):
            sanitized[truncated_key] = value[:MAX_ATTRIBUTE_VALUE_LENGTH]
        elif isinstance(value, list):
            sanitized[truncated_key] = [
                v[:MAX_ATTRIBUTE_VALUE_LENGTH] for v in value[:100]
            ]
        else:
            sanitized[truncated_key] = value
    return sanitized or None


def _now_iso() -> str:
    """ISO 8601 timestamp with millisecond precision and ``Z`` suffix."""
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


class SignaKitUserContext:
    """Represents a user for flag evaluation and event tracking."""

    def __init__(
        self,
        client: SignaKitClient,
        user_id: str,
        attributes: UserAttributes | None = None,
    ) -> None:
        self._client = client
        self.user_id: str = user_id

        attributes = dict(attributes) if attributes else {}
        user_agent_raw = attributes.pop("$userAgent", None)
        user_agent = user_agent_raw if isinstance(user_agent_raw, str) else None
        self._is_bot: bool = is_bot(user_agent)
        self.attributes: UserAttributes = attributes
        self._cached_decisions: dict[str, str] = {}

    # ---- exposure helpers --------------------------------------------------

    def _build_exposure_event(self, decision: Decision) -> dict[str, Any]:
        event: dict[str, Any] = {
            "eventKey": "$exposure",
            "userId": self.user_id[:MAX_USER_ID_LENGTH],
            "timestamp": _now_iso(),
            "decisions": {decision.flag_key: decision.variation_key},
            "metadata": {
                "flagKey": decision.flag_key,
                "variationKey": decision.variation_key,
                "ruleKey": decision.rule_key,
            },
        }
        sanitized = _sanitize_attributes(self.attributes)
        if sanitized:
            event["attributes"] = sanitized
        return event

    def _send_exposure(self, decision: Decision) -> None:
        """Fire-and-forget exposure event.

        Skipped for ``targeted`` rules — those are simple feature-flag rollouts
        with no experiment to attribute, so exposures would just be noise.
        """
        if decision.rule_type == "targeted":
            return

        event = self._build_exposure_event(decision)

        # Prefer scheduling on a running event loop; fall back to synchronous
        # transport so this works in plain scripts too.
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            try:
                self._client._send_event_sync(event)
            except Exception:  # noqa: BLE001 — fire-and-forget
                _logger.debug("[SignaKit] exposure send failed", exc_info=True)
            return

        async def _runner() -> None:
            try:
                await self._client._send_event(event)
            except Exception:  # noqa: BLE001 — fire-and-forget
                _logger.debug("[SignaKit] exposure send failed", exc_info=True)

        loop.create_task(_runner())

    # ---- public API --------------------------------------------------------

    def decide(self, flag_key: str) -> Decision | None:
        """Evaluate a single flag for this user."""
        if self._is_bot:
            return Decision(
                flag_key=flag_key,
                variation_key="off",
                enabled=False,
                rule_key=None,
                rule_type=None,
                variables={},
            )

        decision = self._client._evaluate_flag(flag_key, self.user_id, self.attributes)
        if decision is not None:
            self._cached_decisions[flag_key] = decision.variation_key
            self._send_exposure(decision)
        return decision

    def decide_all(self) -> Decisions:
        """Evaluate every non-archived flag for this user."""
        if self._is_bot:
            return self._client._get_bot_decisions()

        decisions = self._client._evaluate_all_flags(self.user_id, self.attributes)
        self._cached_decisions = {}
        for flag_key, decision in decisions.items():
            self._cached_decisions[flag_key] = decision.variation_key
            self._send_exposure(decision)
        return decisions

    async def track_event(
        self,
        event_key: str,
        value: float | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Track a conversion event for this user (sent immediately)."""
        if self._is_bot:
            return

        event: dict[str, Any] = {
            "eventKey": event_key[:MAX_EVENT_KEY_LENGTH],
            "userId": self.user_id[:MAX_USER_ID_LENGTH],
            "timestamp": _now_iso(),
        }

        sanitized = _sanitize_attributes(self.attributes)
        if sanitized:
            event["attributes"] = sanitized

        if self._cached_decisions:
            event["decisions"] = dict(self._cached_decisions)

        opts = TrackEventOptions(value=value, metadata=metadata)
        if opts.value is not None:
            event["value"] = opts.value

        if opts.metadata is not None:
            metadata_str = json.dumps(opts.metadata)
            if len(metadata_str) <= MAX_METADATA_SIZE_BYTES:
                event["metadata"] = opts.metadata
            else:
                _logger.warning(
                    "[SignaKit] metadata exceeds %d bytes (%d), dropping",
                    MAX_METADATA_SIZE_BYTES,
                    len(metadata_str),
                )

        await self._client._send_event(event)
