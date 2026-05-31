"""Robinhood integration service backed by Supabase portfolio tables."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import pickle
import time
from collections import defaultdict, deque
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from langchain_core.messages import HumanMessage, SystemMessage
import pyotp
import robin_stocks.robinhood as r
from robin_stocks.robinhood.authentication import generate_device_token, respond_to_challenge
from robin_stocks.robinhood.helper import request_get, request_post, set_login_state, update_session
from robin_stocks.robinhood.urls import login_url, positions_url
from supabase import Client

ROBINHOOD_USER_MACHINE_URL = "https://api.robinhood.com/pathfinder/user_machine/"
ROBINHOOD_INQUIRY_URL_TEMPLATE = (
    "https://api.robinhood.com/pathfinder/inquiries/{machine_id}/user_view/"
)
ROBINHOOD_PROMPT_STATUS_URL_TEMPLATE = (
    "https://api.robinhood.com/push/{challenge_id}/get_prompts_status/"
)
ROBINHOOD_DEFAULT_APPROVAL_TIMEOUT_SECONDS = 25
ROBINHOOD_APPROVAL_POLL_INTERVAL_SECONDS = 2.0
ROBINHOOD_PENDING_WORKFLOW_TTL_SECONDS = 5 * 60

from app.core.supabase import get_supabase_service
from app.agent.llm import get_llm
from app.services.portfolio_snapshot_service import get_portfolio_snapshot_service
from app.services.yfinance.client import get_yfinance_service

logger = logging.getLogger(__name__)

_sync_locks: Dict[str, asyncio.Lock] = {}

# Tracks the currently-running background sync per user so we don't kick off
# duplicates when the frontend polls or double-clicks. Cleared in the task's
# finally block.
_background_sync_tasks: Dict[str, asyncio.Task] = {}

# Auto-expire `is_syncing` flags older than this so a crashed worker can't
# leave the row stuck "syncing" forever.
ROBINHOOD_SYNC_STALE_AFTER_SECONDS = 15 * 60


class RobinhoodStorageNotReady(Exception):
    """Raised when the Robinhood Supabase migration has not been applied."""


class RobinhoodLoginApprovalRequired(Exception):
    """Raised when Robinhood requires mobile/app approval before login can continue."""


class RobinhoodSessionExpired(Exception):
    """Raised when the cached Robinhood session is missing/expired and we can't refresh.

    The caller should surface this to the API as a 401-style response so the
    user knows to reconnect (re-enter their credentials), rather than crashing
    the worker.
    """


def _get_user_lock(user_id: str) -> asyncio.Lock:
    if user_id not in _sync_locks:
        _sync_locks[user_id] = asyncio.Lock()
    return _sync_locks[user_id]


def _safe_float(value: object, default: float = 0.0) -> float:
    if value in (None, ""):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_str(value: object, default: str = "") -> str:
    if value in (None, ""):
        return default
    return str(value)


def _order_state_matches(order_state: object, status_filter: str) -> bool:
    state = _safe_str(order_state).lower()
    target = status_filter.lower()
    aliases = {
        "cancelled": {"cancelled", "canceled"},
        "canceled": {"cancelled", "canceled"},
    }
    return state in aliases.get(target, {target})


def _parse_robinhood_timestamp(value: str | None) -> str | None:
    """Parse Robinhood API timestamps into naive UTC ISO strings for Postgres."""
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        value = str(value)
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        try:
            parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ").replace(
                tzinfo=timezone.utc
            )
        except ValueError:
            try:
                parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(
                    tzinfo=timezone.utc
                )
            except ValueError:
                return None
    except TypeError:
        return None

    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed.isoformat(timespec="microseconds")


def _parse_order_datetime(value: str | datetime | None) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        parsed = value
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    if not isinstance(value, str):
        value = str(value)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except (TypeError, ValueError):
        return None


def _is_missing_robinhood_table_error(error: Exception) -> bool:
    message = str(error).lower()
    return (
        "robinhood_connections" in message
        or "robinhood_stock_orders" in message
        or "robinhood_option_orders" in message
        or "could not find the table" in message
        or ("relation" in message and "does not exist" in message)
    )


def _option_id_from_url(value: object) -> str:
    if not value:
        return ""
    text = str(value).rstrip("/")
    return text.split("/")[-1]


class RobinhoodService:
    """Connect, sync, and query Robinhood data for a Kolvex user."""

    def __init__(self, supabase: Optional[Client] = None):
        self.supabase = supabase or get_supabase_service()

    def _session_name(self, user_id: str) -> str:
        safe_user_id = "".join(ch for ch in user_id if ch.isalnum() or ch in "-_")
        return f"kolvex_robinhood_{safe_user_id}"

    def _tokens_dir(self) -> Path:
        data_dir = Path(os.path.expanduser("~")) / ".tokens"
        data_dir.mkdir(parents=True, exist_ok=True)
        return data_dir

    def _pickle_path(self, user_id: str) -> Path:
        return self._tokens_dir() / f"robinhood{self._session_name(user_id)}.pickle"

    def _device_token_path(self) -> Path:
        return self._tokens_dir() / "kolvex_robinhood_device_tokens.json"

    def _write_local_device_token(self, user_id: str, device_token: str) -> None:
        token_path = self._device_token_path()
        key = self._session_name(user_id)
        tokens: Dict[str, str] = {}

        if token_path.exists():
            try:
                tokens = json.loads(token_path.read_text())
            except json.JSONDecodeError:
                tokens = {}

        tokens[key] = device_token
        token_path.write_text(json.dumps(tokens))

    def _remove_local_device_token(self, user_id: str) -> None:
        token_path = self._device_token_path()
        key = self._session_name(user_id)
        if not token_path.exists():
            return
        try:
            tokens = json.loads(token_path.read_text())
        except json.JSONDecodeError:
            tokens = {}
        if key in tokens:
            tokens.pop(key, None)
            token_path.write_text(json.dumps(tokens))

    def _create_device_token(self, user_id: str) -> str:
        device_token = generate_device_token()
        try:
            self._write_local_device_token(user_id, device_token)
        except OSError as error:
            logger.warning(
                "Could not write local Robinhood device token for user %s: %s",
                user_id,
                error,
            )
        return device_token

    def _get_device_token(self, user_id: str) -> str:
        token_path = self._device_token_path()
        key = self._session_name(user_id)
        tokens: Dict[str, str] = {}

        if token_path.exists():
            try:
                tokens = json.loads(token_path.read_text())
            except json.JSONDecodeError:
                tokens = {}

        if key not in tokens:
            tokens[key] = generate_device_token()
            token_path.write_text(json.dumps(tokens))

        return tokens[key]

    def _get_or_create_device_token(self, user_id: str, username: str) -> str:
        """Persist the Robinhood device token in Supabase so app approval survives redeploys."""

        try:
            existing = (
                self.supabase.table("robinhood_connections")
                .select("device_token")
                .eq("user_id", user_id)
                .execute()
            )
            if existing.data and existing.data[0].get("device_token"):
                return existing.data[0]["device_token"]

            # Supabase is the durable source of truth. If the row was deleted
            # after a denied mobile approval, don't resurrect the old local
            # device token that Robinhood may already have rejected.
            device_token = self._create_device_token(user_id)
            self.supabase.table("robinhood_connections").upsert(
                {
                    "user_id": user_id,
                    "username": username,
                    "session_pickle_name": self._session_name(user_id),
                    "device_token": device_token,
                    "is_connected": False,
                },
                on_conflict="user_id",
            ).execute()
            return device_token
        except Exception as error:
            if _is_missing_robinhood_table_error(error):
                raise RobinhoodStorageNotReady(
                    "Robinhood database migration has not been applied."
                ) from error
            logger.warning(
                "Falling back to local Robinhood device token for user %s: %s",
                user_id,
                error,
            )
            return self._get_device_token(user_id)

    def _get_pending_challenge_id(self, user_id: str) -> str | None:
        try:
            existing = (
                self.supabase.table("robinhood_connections")
                .select("pending_challenge_id")
                .eq("user_id", user_id)
                .execute()
            )
            if existing.data:
                return existing.data[0].get("pending_challenge_id")
        except Exception as error:
            logger.warning(
                "Could not read Robinhood pending challenge for user %s: %s",
                user_id,
                error,
            )
        return None

    def _set_pending_challenge_id(self, user_id: str, challenge_id: str | None) -> None:
        try:
            self.supabase.table("robinhood_connections").update(
                {"pending_challenge_id": challenge_id}
            ).eq("user_id", user_id).execute()
        except Exception as error:
            logger.warning(
                "Could not persist Robinhood pending challenge for user %s: %s",
                user_id,
                error,
            )

    def _login(
        self,
        user_id: str,
        username: str,
        password: str,
        totp_secret: str | None = None,
        challenge_code: str | None = None,
    ) -> Dict[str, Any]:
        mfa_code = pyotp.TOTP(totp_secret).now() if totp_secret else None
        return self._login_with_stable_device_token(
            user_id=user_id,
            username=username,
            password=password,
            mfa_code=mfa_code,
            challenge_code=challenge_code,
        )

    def _login_from_cache(self, user_id: str) -> None:
        """Restore an authenticated Robinhood session from the per-user pickle.

        Unlike :func:`robin_stocks.robinhood.authentication.login`, this method
        NEVER falls back to interactive ``input()`` prompts. If the cached
        session can't be restored or refreshed, it raises
        :class:`RobinhoodSessionExpired` so the API can return a clear
        "please reconnect" response instead of crashing with
        ``EOF when reading a line`` on a headless server.
        """

        tokens = self._load_session_tokens(user_id)
        if not tokens or not tokens.get("access_token"):
            raise RobinhoodSessionExpired(
                "Robinhood session not found. Please connect Robinhood again."
            )

        access_token = tokens["access_token"]
        token_type = tokens.get("token_type") or "Bearer"
        refresh_token = tokens.get("refresh_token")
        device_token = tokens.get("device_token")

        set_login_state(True)
        update_session("Authorization", f"{token_type} {access_token}")

        try:
            response = request_get(
                positions_url(),
                "pagination",
                {"nonzero": "true"},
                jsonify_data=False,
            )
            response.raise_for_status()
            return
        except Exception as validation_error:
            logger.info(
                "Robinhood cached session invalid for user %s, attempting refresh: %s",
                user_id,
                validation_error,
            )
            set_login_state(False)
            update_session("Authorization", None)

        if not refresh_token or not device_token:
            raise RobinhoodSessionExpired(
                "Robinhood session expired and cannot be refreshed. Please connect Robinhood again."
            )

        try:
            refresh_payload = {
                "client_id": "c82SH0WZOsabOXGP2sxqcj34FxkvfnWRZBKlBjFS",
                "expires_in": 86400,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "scope": "internal",
                "device_token": device_token,
            }
            refreshed = request_post(login_url(), refresh_payload)
        except Exception as error:
            raise RobinhoodSessionExpired(
                "Robinhood session refresh failed. Please connect Robinhood again."
            ) from error

        if not isinstance(refreshed, dict) or not refreshed.get("access_token"):
            raise RobinhoodSessionExpired(
                "Robinhood session refresh was rejected. Please connect Robinhood again."
            )

        new_access_token = refreshed["access_token"]
        new_token_type = refreshed.get("token_type") or token_type
        new_refresh_token = refreshed.get("refresh_token") or refresh_token

        update_session("Authorization", f"{new_token_type} {new_access_token}")
        set_login_state(True)

        self._save_session_tokens(
            user_id,
            token_type=new_token_type,
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            device_token=device_token,
        )

    def _start_device_approval_workflow(
        self,
        user_id: str,
        workflow_id: str,
        device_token: str,
    ) -> str:
        """Kick off Robinhood's pathfinder workflow and return the machine_id.

        This also persists the machine_id so subsequent /connect calls can
        resume the SAME mobile push instead of generating a new one.
        """

        machine_response = request_post(
            ROBINHOOD_USER_MACHINE_URL,
            {
                "device_id": device_token,
                "flow": "suv",
                "input": {"workflow_id": workflow_id},
            },
            json=True,
        )
        if not isinstance(machine_response, dict) or "id" not in machine_response:
            logger.warning(
                "Robinhood user_machine response was unexpected for user %s: %s",
                user_id,
                machine_response,
            )
            raise RobinhoodLoginApprovalRequired(
                "Robinhood device-approval workflow could not be started. Try again."
            )
        machine_id = machine_response["id"]
        self._save_pending_machine_id(user_id, machine_id)
        logger.info(
            "Robinhood device-approval workflow started for user %s: machine_id=%s",
            user_id,
            machine_id,
        )
        return machine_id

    def _drive_device_approval_workflow(
        self,
        user_id: str,
        machine_id: str,
        timeout_seconds: int = ROBINHOOD_DEFAULT_APPROVAL_TIMEOUT_SECONDS,
        poll_interval: float = ROBINHOOD_APPROVAL_POLL_INTERVAL_SECONDS,
    ) -> None:
        """Poll a previously started workflow until it's approved, then advance it.

        Raises :class:`RobinhoodLoginApprovalRequired` when the user hasn't tapped
        "Yes, it's me" yet so the caller can return ``approval_required`` to the
        client. Pending state is preserved on timeout so the next /connect call
        can resume from the SAME mobile push without re-triggering one.
        """

        inquiry_url = ROBINHOOD_INQUIRY_URL_TEMPLATE.format(machine_id=machine_id)

        challenge = self._get_active_sheriff_challenge(inquiry_url)
        if not challenge or not challenge.get("id"):
            # Inquiry expired or returned nothing - drop the stale state so we
            # start a fresh workflow on the next /connect.
            self._clear_pending_workflow_state(user_id)
            raise RobinhoodLoginApprovalRequired(
                "Robinhood device-approval session expired. Click Connect Robinhood again to retry."
            )
        challenge_id = challenge["id"]
        challenge_type = challenge.get("type")
        logger.info(
            "Robinhood device-approval challenge for user %s: id=%s type=%s",
            user_id,
            challenge_id,
            challenge_type,
        )

        if challenge_type != "prompt":
            self._set_pending_challenge_id(user_id, challenge_id)
            raise RobinhoodLoginApprovalRequired(
                f"Robinhood requires {challenge_type or 'manual'} verification. Approve it in the Robinhood app, then click Connect Robinhood again."
            )

        if not self._wait_for_prompt_approval(
            challenge_id=challenge_id,
            timeout_seconds=timeout_seconds,
            poll_interval=poll_interval,
        ):
            # Keep pending state - subsequent /connect call will resume this push.
            raise RobinhoodLoginApprovalRequired(
                'Robinhood is still waiting for device approval. Tap "Yes, it\'s me" in the Robinhood app - we\'ll pick up where we left off when you click Connect Robinhood again.'
            )

        # Advance the workflow so the next /oauth2/token call gets an access_token.
        request_post(
            inquiry_url,
            {"sequence": 0, "user_input": {"status": "continue"}},
            json=True,
        )
        logger.info(
            "Robinhood device-approval workflow completed for user %s",
            user_id,
        )

    # ---- Pending workflow state (Supabase-backed, with graceful fallback) ----

    def _save_pending_machine_id(self, user_id: str, machine_id: str) -> None:
        try:
            self.supabase.table("robinhood_connections").update(
                {
                    "pending_machine_id": machine_id,
                    "pending_workflow_started_at": datetime.utcnow().isoformat(),
                }
            ).eq("user_id", user_id).execute()
        except Exception as error:
            # Tolerate missing columns (migration not applied) - we'll just lose
            # resume capability and fall back to single-shot polling.
            logger.warning(
                "Could not persist Robinhood pending workflow state for user %s: %s",
                user_id,
                error,
            )

    def _clear_pending_workflow_state(self, user_id: str) -> None:
        try:
            self.supabase.table("robinhood_connections").update(
                {
                    "pending_machine_id": None,
                    "pending_workflow_started_at": None,
                }
            ).eq("user_id", user_id).execute()
        except Exception as error:
            logger.warning(
                "Could not clear Robinhood pending workflow state for user %s: %s",
                user_id,
                error,
            )

    def _get_pending_machine_id(self, user_id: str) -> Optional[str]:
        """Return the machine_id of an in-progress workflow, if still fresh."""
        try:
            result = (
                self.supabase.table("robinhood_connections")
                .select("pending_machine_id, pending_workflow_started_at")
                .eq("user_id", user_id)
                .execute()
            )
        except Exception as error:
            # Columns might not exist yet (migration pending). That's fine -
            # we just always start a fresh workflow.
            logger.debug(
                "Could not read Robinhood pending workflow state for user %s: %s",
                user_id,
                error,
            )
            return None

        if not result.data:
            return None
        row = result.data[0]
        machine_id = row.get("pending_machine_id")
        started_at = row.get("pending_workflow_started_at")
        if not machine_id:
            return None
        if started_at:
            try:
                started_dt = datetime.fromisoformat(
                    started_at.replace("Z", "+00:00")
                )
                age_seconds = (
                    datetime.now(started_dt.tzinfo) - started_dt
                ).total_seconds()
                if age_seconds > ROBINHOOD_PENDING_WORKFLOW_TTL_SECONDS:
                    return None
            except (TypeError, ValueError):
                pass
        return machine_id

    # ---- OAuth token persistence (Supabase primary, pickle cache) -----------
    #
    # Railway/Docker filesystems are ephemeral so the per-user pickle file at
    # ~/.tokens/ disappears on every redeploy. To survive that we mirror tokens
    # into Supabase: the DB row is the source of truth, the pickle is just an
    # in-process cache that avoids a Supabase round-trip on each /sync call.
    # All DB reads/writes are tolerant to the columns not yet existing so the
    # service keeps working before the migration is applied.

    def _save_session_tokens(
        self,
        user_id: str,
        *,
        token_type: str,
        access_token: str,
        refresh_token: str,
        device_token: str,
    ) -> None:
        pickle_path = self._pickle_path(user_id)
        pickle_payload = {
            "token_type": token_type,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "device_token": device_token,
        }
        try:
            with pickle_path.open("wb") as f:
                pickle.dump(pickle_payload, f)
        except OSError as error:
            logger.warning(
                "Could not write Robinhood pickle for user %s: %s",
                user_id,
                error,
            )

        try:
            self.supabase.table("robinhood_connections").update(
                {
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "token_type": token_type,
                    "device_token": device_token,
                    "access_token_saved_at": datetime.utcnow().isoformat(),
                }
            ).eq("user_id", user_id).execute()
        except Exception as error:
            # Migration not applied yet -> silently fall back to pickle-only
            # so existing deployments keep working.
            logger.warning(
                "Could not persist Robinhood OAuth tokens to Supabase for user %s: %s",
                user_id,
                error,
            )

    def _load_session_tokens(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Return ``{access_token, refresh_token, token_type, device_token}`` or None.

        Reads Supabase first (durable across redeploys); falls back to the
        per-user pickle for legacy installs / when the migration isn't applied.
        """

        try:
            result = (
                self.supabase.table("robinhood_connections")
                .select("access_token, refresh_token, token_type, device_token")
                .eq("user_id", user_id)
                .execute()
            )
        except Exception as error:
            logger.debug(
                "Could not read Robinhood OAuth tokens from Supabase for user %s: %s",
                user_id,
                error,
            )
            result = None

        if result and result.data:
            row = result.data[0]
            access_token = row.get("access_token")
            if access_token:
                return {
                    "access_token": access_token,
                    "refresh_token": row.get("refresh_token"),
                    "token_type": row.get("token_type") or "Bearer",
                    "device_token": row.get("device_token"),
                }

        pickle_path = self._pickle_path(user_id)
        if not pickle_path.exists():
            return None
        try:
            with pickle_path.open("rb") as f:
                data = pickle.load(f)
        except (pickle.UnpicklingError, EOFError, OSError, KeyError) as error:
            logger.warning(
                "Could not read Robinhood pickle for user %s: %s",
                user_id,
                error,
            )
            return None
        if not isinstance(data, dict) or not data.get("access_token"):
            return None
        return {
            "access_token": data["access_token"],
            "refresh_token": data.get("refresh_token"),
            "token_type": data.get("token_type") or "Bearer",
            "device_token": data.get("device_token"),
        }

    def _clear_session_tokens(self, user_id: str) -> None:
        try:
            self.supabase.table("robinhood_connections").update(
                {
                    "access_token": None,
                    "refresh_token": None,
                    "token_type": None,
                    "access_token_saved_at": None,
                }
            ).eq("user_id", user_id).execute()
        except Exception as error:
            logger.debug(
                "Could not clear Robinhood OAuth tokens for user %s: %s",
                user_id,
                error,
            )

        pickle_path = self._pickle_path(user_id)
        if pickle_path.exists():
            try:
                pickle_path.unlink()
            except OSError as error:
                logger.warning(
                    "Could not remove Robinhood pickle for user %s: %s",
                    user_id,
                    error,
                )

    def reset_login_state(self, user_id: str) -> None:
        """Clear denied/stale Robinhood auth state and force a fresh approval."""

        self._clear_session_tokens(user_id)
        self._remove_local_device_token(user_id)
        set_login_state(False)
        update_session("Authorization", None)
        update_session("X-ROBINHOOD-CHALLENGE-RESPONSE-ID", None)

        try:
            self.supabase.table("robinhood_connections").update(
                {
                    "device_token": None,
                    "pending_challenge_id": None,
                    "pending_machine_id": None,
                    "pending_workflow_started_at": None,
                    "is_connected": False,
                }
            ).eq("user_id", user_id).execute()
        except Exception as error:
            logger.info(
                "Could not reset Robinhood DB auth state for user %s; local state was cleared: %s",
                user_id,
                error,
            )

    async def reset_auth(self, user_id: str) -> bool:
        await asyncio.to_thread(self.reset_login_state, user_id)
        return True

    def _get_active_sheriff_challenge(self, inquiry_url: str) -> Optional[Dict[str, Any]]:
        inquiry = request_get(inquiry_url, "regular")
        if not isinstance(inquiry, dict):
            return None
        challenge = (
            (inquiry.get("type_context") or {}).get("context", {}).get("sheriff_challenge")
        )
        if isinstance(challenge, dict) and challenge.get("id"):
            return challenge
        return None

    def _wait_for_prompt_approval(
        self,
        challenge_id: str,
        timeout_seconds: int,
        poll_interval: float,
    ) -> bool:
        prompt_status_url = ROBINHOOD_PROMPT_STATUS_URL_TEMPLATE.format(
            challenge_id=challenge_id
        )
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            status_response = request_get(prompt_status_url, "regular")
            challenge_status = (
                (status_response or {}).get("challenge_status")
                if isinstance(status_response, dict)
                else None
            )
            if challenge_status == "validated":
                return True
            if challenge_status in ("failed", "denied", "rejected"):
                raise RobinhoodLoginApprovalRequired(
                    "Robinhood device approval was denied. Try connecting again."
                )
            time.sleep(poll_interval)
        return False

    def _login_with_stable_device_token(
        self,
        user_id: str,
        username: str,
        password: str,
        mfa_code: str | None = None,
        challenge_code: str | None = None,
        expires_in: int = 86400,
    ) -> Dict[str, Any]:
        """Login without interactive prompts and reuse device_token across retries."""

        payload = {
            "client_id": "c82SH0WZOsabOXGP2sxqcj34FxkvfnWRZBKlBjFS",
            "expires_in": expires_in,
            "grant_type": "password",
            "password": password,
            "scope": "internal",
            "username": username,
            "challenge_type": "sms",
            "device_token": self._get_or_create_device_token(user_id, username),
        }
        if mfa_code:
            payload["mfa_code"] = mfa_code

        cached_tokens = self._load_session_tokens(user_id)
        if cached_tokens and cached_tokens.get("access_token"):
            try:
                access_token = cached_tokens["access_token"]
                token_type = cached_tokens.get("token_type") or "Bearer"
                refresh_token = cached_tokens.get("refresh_token")
                payload["device_token"] = (
                    cached_tokens.get("device_token") or payload["device_token"]
                )
                set_login_state(True)
                update_session("Authorization", f"{token_type} {access_token}")
                response = request_get(
                    positions_url(),
                    "pagination",
                    {"nonzero": "true"},
                    jsonify_data=False,
                )
                response.raise_for_status()
                return {
                    "access_token": access_token,
                    "token_type": token_type,
                    "expires_in": expires_in,
                    "scope": "internal",
                    "detail": "logged in using cached Robinhood OAuth tokens.",
                    "backup_code": None,
                    "refresh_token": refresh_token,
                }
            except Exception:
                set_login_state(False)
                update_session("Authorization", None)

        # If we already started a verification workflow on a previous /connect
        # call and the user has now tapped "Yes, it's me", advance the workflow
        # in place. We only re-POST to /oauth2/token after that succeeds.
        pending_machine_id = self._get_pending_machine_id(user_id)
        if pending_machine_id:
            try:
                self._drive_device_approval_workflow(
                    user_id=user_id,
                    machine_id=pending_machine_id,
                )
            except RobinhoodLoginApprovalRequired:
                # User hasn't approved yet - keep state, surface to caller.
                raise
            self._clear_pending_workflow_state(user_id)
            data = request_post(login_url(), payload)
            if data and "access_token" in data:
                self._set_pending_challenge_id(user_id, None)
                token = f"{data['token_type']} {data['access_token']}"
                update_session("Authorization", token)
                set_login_state(True)
                data["detail"] = (
                    "logged in after Robinhood device approval (resumed workflow)."
                )
                self._save_session_tokens(
                    user_id,
                    token_type=data["token_type"],
                    access_token=data["access_token"],
                    refresh_token=data["refresh_token"],
                    device_token=payload["device_token"],
                )
                return data
            # Otherwise fall through to normal handling (verification_workflow
            # might have rotated, fresh challenge appeared, etc.)

        pending_challenge_id = self._get_pending_challenge_id(user_id)
        if pending_challenge_id:
            if challenge_code:
                challenge_response = respond_to_challenge(
                    pending_challenge_id,
                    challenge_code,
                )
                logger.info(
                    "Robinhood challenge response for user %s: keys=%s remaining_attempts=%s",
                    user_id,
                    sorted(challenge_response.keys()) if challenge_response else [],
                    (challenge_response or {})
                    .get("challenge", {})
                    .get("remaining_attempts"),
                )
                if challenge_response and "challenge" in challenge_response:
                    remaining = challenge_response["challenge"].get(
                        "remaining_attempts"
                    )
                    raise RobinhoodLoginApprovalRequired(
                        f"Robinhood verification code was not accepted. {remaining} attempts remaining."
                    )
            update_session(
                "X-ROBINHOOD-CHALLENGE-RESPONSE-ID",
                pending_challenge_id,
            )
        else:
            update_session("X-ROBINHOOD-CHALLENGE-RESPONSE-ID", None)

        data = request_post(login_url(), payload)
        if not data:
            raise Exception("Robinhood login failed: empty response from API")

        logger.info(
            "Robinhood login response for user %s: keys=%s detail=%s mfa_required=%s challenge=%s workflow=%s",
            user_id,
            sorted(data.keys()),
            data.get("detail") or data.get("error"),
            data.get("mfa_required"),
            bool(data.get("challenge")),
            bool(data.get("verification_workflow")),
        )

        if data.get("mfa_required") and not mfa_code:
            raise RobinhoodLoginApprovalRequired(
                "Robinhood MFA is required. Add the TOTP secret and try again."
            )

        # Modern (2024+) Robinhood flow: device approval is delivered via a
        # `verification_workflow`. We start the pathfinder workflow (which
        # triggers a "Yes, it's me" mobile push), block briefly to wait for
        # the user, then re-POST /oauth2/token. If the user doesn't tap in
        # time we persist the workflow id so the next /connect call resumes
        # the same push instead of generating another one.
        verification_workflow = data.get("verification_workflow") or {}
        workflow_id = verification_workflow.get("id")
        if workflow_id:
            machine_id = self._start_device_approval_workflow(
                user_id=user_id,
                workflow_id=workflow_id,
                device_token=payload["device_token"],
            )
            self._drive_device_approval_workflow(
                user_id=user_id,
                machine_id=machine_id,
            )
            self._clear_pending_workflow_state(user_id)
            data = request_post(login_url(), payload)
            if not data:
                raise Exception(
                    "Robinhood login failed after device approval: empty response from API"
                )
            logger.info(
                "Robinhood post-approval login response for user %s: keys=%s detail=%s",
                user_id,
                sorted(data.keys()),
                data.get("detail") or data.get("error"),
            )

        if "challenge" in data:
            challenge_id = data["challenge"].get("id")
            if challenge_id:
                self._set_pending_challenge_id(user_id, challenge_id)
            raise RobinhoodLoginApprovalRequired(
                "Robinhood sent a login challenge. Approve it on your phone, then click Connect Robinhood again. If Robinhood sent a code, enter it in the verification code field."
            )

        detail = str(data.get("detail") or data.get("error") or "")
        if "access_token" not in data:
            approval_markers = [
                "approve",
                "confirm",
                "device",
                "challenge",
                "login request",
                "verification",
            ]
            if any(marker in detail.lower() for marker in approval_markers):
                raise RobinhoodLoginApprovalRequired(
                    "Robinhood is waiting for device approval. Open the Robinhood app and tap \"Yes, it's me\" within ~2 minutes, then click Connect Robinhood again."
                )
            raise Exception(detail or f"Robinhood login failed: {data}")

        self._set_pending_challenge_id(user_id, None)

        token = f"{data['token_type']} {data['access_token']}"
        update_session("Authorization", token)
        set_login_state(True)
        data["detail"] = "logged in with brand new authentication code."

        self._save_session_tokens(
            user_id,
            token_type=data["token_type"],
            access_token=data["access_token"],
            refresh_token=data["refresh_token"],
            device_token=payload["device_token"],
        )

        return data

    async def connect(
        self,
        user_id: str,
        username: str,
        password: str,
        totp_secret: str | None = None,
        challenge_code: str | None = None,
    ) -> Dict[str, Any]:
        """Login + persist tokens, then schedule the heavy sync in the background.

        Returns immediately so the API request finishes well within the Vercel
        edge-proxy timeout. The frontend should poll ``GET /status`` to see
        when the background sync's ``is_syncing`` flag flips back to false.
        """

        async with _get_user_lock(user_id):
            await asyncio.to_thread(
                self._login,
                user_id,
                username,
                password,
                totp_secret,
                challenge_code,
            )
            profile = await self._fetch_profile()
            connection = await self._upsert_robinhood_connection(
                user_id=user_id,
                username=username,
                profile=profile,
            )

        scheduled = self.schedule_background_sync(user_id, profile=profile)
        return {
            "success": True,
            "is_connected": True,
            "is_syncing": scheduled,
            "last_synced_at": connection.get("last_synced_at"),
            "profile": profile,
            "positions_synced": 0,
        }

    async def sync(
        self,
        user_id: str,
        profile: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Synchronous full sync. Internal use only - HTTP handlers should
        prefer :meth:`schedule_background_sync` to avoid client-side timeouts."""

        async with _get_user_lock(user_id):
            return await self._sync_unlocked(user_id, profile=profile)

    def schedule_background_sync(
        self,
        user_id: str,
        profile: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Start ``_sync_unlocked`` in a background task if one isn't already
        running for this user. Returns True if a new task was scheduled,
        False if a sync was already in progress (caller should treat that as
        success - the existing task will finish soon)."""

        existing = _background_sync_tasks.get(user_id)
        if existing and not existing.done():
            return False

        # Mark the row as syncing right away so /status reflects state even
        # before the task gets its first chance to run.
        self._set_sync_state(user_id, is_syncing=True, error=None)

        loop = asyncio.get_event_loop()
        task = loop.create_task(self._run_background_sync(user_id, profile))
        _background_sync_tasks[user_id] = task
        return True

    async def _run_background_sync(
        self,
        user_id: str,
        profile: Optional[Dict[str, Any]],
    ) -> None:
        """Coroutine entry point for the background sync task. Holds the
        per-user lock so simultaneous /connect + /sync don't double-fetch."""

        try:
            async with _get_user_lock(user_id):
                await self._sync_unlocked(user_id, profile=profile)
            self._set_sync_state(user_id, is_syncing=False, error=None)
        except RobinhoodSessionExpired as error:
            logger.info(
                "Background Robinhood sync hit expired session for user %s",
                user_id,
            )
            self._set_sync_state(user_id, is_syncing=False, error=str(error))
        except Exception as error:
            logger.exception(
                "Background Robinhood sync failed for user %s", user_id
            )
            self._set_sync_state(
                user_id, is_syncing=False, error=str(error)[:500]
            )
        finally:
            _background_sync_tasks.pop(user_id, None)

    def _set_sync_state(
        self,
        user_id: str,
        *,
        is_syncing: bool,
        error: Optional[str],
    ) -> None:
        """Persist the in-progress sync flag. Tolerant of the migration not
        having been applied yet - we just lose progress visibility in that
        case, the sync itself still works."""

        update: Dict[str, Any] = {"is_syncing": is_syncing}
        if is_syncing:
            update["sync_started_at"] = datetime.utcnow().isoformat()
        if error is not None:
            update["last_sync_error"] = error
        elif not is_syncing:
            # Successful completion clears the error column.
            update["last_sync_error"] = None
        try:
            self.supabase.table("robinhood_connections").update(update).eq(
                "user_id", user_id
            ).execute()
        except Exception as db_error:
            logger.debug(
                "Could not persist Robinhood sync state for user %s: %s",
                user_id,
                db_error,
            )

    async def _sync_unlocked(
        self,
        user_id: str,
        profile: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        connection = await self._get_robinhood_connection(user_id)
        if not connection:
            raise Exception("Robinhood is not connected")

        try:
            await asyncio.to_thread(self._login_from_cache, user_id)
        except RobinhoodSessionExpired:
            # Mark the connection disconnected so /status tells the UI to
            # prompt the user to reconnect, then propagate to the route
            # handler which turns it into a clean 401.
            try:
                self.supabase.table("robinhood_connections").update(
                    {"is_connected": False}
                ).eq("user_id", user_id).execute()
            except Exception as flag_error:
                logger.warning(
                    "Could not clear is_connected flag for user %s: %s",
                    user_id,
                    flag_error,
                )
            raise

        if profile is None:
            profile = await self._fetch_profile()

        portfolio_connection = await self._ensure_portfolio_connection(user_id)
        account = await self._upsert_portfolio_account(
            connection_id=portfolio_connection["id"],
            user_id=user_id,
            profile=profile,
        )
        option_positions_data: Optional[List[Dict[str, Any]]] = None
        try:
            option_positions_data = await asyncio.to_thread(
                r.get_open_option_positions
            )
            logger.info(
                "Fetched %d open option positions from Robinhood for user %s",
                len(option_positions_data) if option_positions_data else 0,
                user_id,
            )
        except Exception as error:
            logger.warning(
                "Could not fetch Robinhood option positions for user %s: %s",
                user_id,
                error,
                exc_info=True,
            )

        positions = await self._sync_positions(
            account_id=account["id"],
            holdings_data=await asyncio.to_thread(r.build_holdings),
            option_positions_data=option_positions_data,
        )
        orders_count = await self._sync_orders(user_id)
        option_orders_count = await self._sync_option_orders(user_id)

        now = datetime.utcnow().isoformat()
        self.supabase.table("snaptrade_connections").update(
            {"is_connected": True, "last_synced_at": now}
        ).eq("id", portfolio_connection["id"]).execute()
        self.supabase.table("robinhood_connections").update(
            {
                "is_connected": True,
                "last_synced_at": now,
                "profile": profile,
                "account_number": profile.get("account_number"),
                "portfolio_value": _safe_float(profile.get("equity")),
                "cash_balance": _safe_float(profile.get("cash")),
                "buying_power": _safe_float(profile.get("buying_power")),
                "total_equity": _safe_float(profile.get("equity")),
            }
        ).eq("user_id", user_id).execute()

        await self._record_snapshot(user_id, positions)
        logger.info(
            "Robinhood sync completed for user %s: %s positions, %s stock orders, %s option legs",
            user_id,
            len(positions),
            orders_count,
            option_orders_count,
        )
        return positions

    async def get_status(self, user_id: str) -> Dict[str, Any]:
        try:
            connection = await self._get_robinhood_connection(user_id)
        except RobinhoodStorageNotReady as error:
            logger.warning("Robinhood storage is not ready: %s", error)
            return {
                "is_connected": False,
                "last_synced_at": None,
                "profile": None,
                "positions_count": 0,
                "option_positions_count": 0,
                "orders_count": 0,
                "setup_required": True,
                "message": str(error),
                "is_syncing": False,
                "sync_started_at": None,
                "last_sync_error": None,
            }

        if not connection:
            return {
                "is_connected": False,
                "last_synced_at": None,
                "profile": None,
                "positions_count": 0,
                "option_positions_count": 0,
                "orders_count": 0,
                "is_syncing": False,
                "sync_started_at": None,
                "last_sync_error": None,
            }

        account = await self._get_portfolio_account(user_id)
        positions_count = 0
        option_positions_count = 0
        if account:
            result = (
                self.supabase.table("snaptrade_positions")
                .select("id", count="exact")
                .eq("account_id", account["id"])
                .execute()
            )
            positions_count = result.count or 0
            try:
                option_result = (
                    self.supabase.table("snaptrade_positions")
                    .select("id", count="exact")
                    .eq("account_id", account["id"])
                    .eq("position_type", "option")
                    .execute()
                )
                option_positions_count = option_result.count or 0
            except Exception:
                pass

        stock_orders = (
            self.supabase.table("robinhood_stock_orders")
            .select("order_id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        option_orders_count = 0
        try:
            option_orders = (
                self.supabase.table("robinhood_option_orders")
                .select("option_order_id", count="exact")
                .eq("user_id", user_id)
                .execute()
            )
            option_orders_count = option_orders.count or 0
        except Exception as error:
            if _is_missing_robinhood_table_error(error):
                logger.info("Robinhood option orders table is not ready yet")
            else:
                raise

        is_syncing, sync_started_at = self._derive_sync_state(user_id, connection)

        return {
            "is_connected": connection.get("is_connected", False),
            "last_synced_at": connection.get("last_synced_at"),
            "profile": connection.get("profile"),
            "positions_count": positions_count,
            "option_positions_count": option_positions_count,
            "orders_count": (stock_orders.count or 0) + option_orders_count,
            "is_syncing": is_syncing,
            "sync_started_at": sync_started_at,
            "last_sync_error": connection.get("last_sync_error"),
        }

    def _derive_sync_state(
        self,
        user_id: str,
        connection: Dict[str, Any],
    ) -> tuple[bool, Optional[str]]:
        """Combine in-process + DB state to decide if a sync is still running.

        Auto-clears stale ``is_syncing`` flags older than
        :data:`ROBINHOOD_SYNC_STALE_AFTER_SECONDS` so a worker crash can't
        leave the row stuck "syncing" forever from the user's perspective.
        """

        in_memory_task = _background_sync_tasks.get(user_id)
        if in_memory_task and not in_memory_task.done():
            return True, connection.get("sync_started_at") or datetime.utcnow().isoformat()

        db_is_syncing = bool(connection.get("is_syncing"))
        sync_started_at = connection.get("sync_started_at")
        if not db_is_syncing:
            return False, sync_started_at

        # DB says syncing but we don't have a live task - check if it's stale.
        if sync_started_at:
            try:
                started_dt = datetime.fromisoformat(
                    sync_started_at.replace("Z", "+00:00")
                )
                age_seconds = (
                    datetime.now(started_dt.tzinfo) - started_dt
                ).total_seconds()
                if age_seconds > ROBINHOOD_SYNC_STALE_AFTER_SECONDS:
                    self._set_sync_state(
                        user_id,
                        is_syncing=False,
                        error=connection.get("last_sync_error")
                        or "Background sync did not finish (worker restart?). Try syncing again.",
                    )
                    return False, sync_started_at
            except (TypeError, ValueError):
                pass

        return True, sync_started_at

    async def get_profile(self, user_id: str) -> Dict[str, Any]:
        connection = await self._get_robinhood_connection(user_id)
        if not connection:
            raise Exception("Robinhood is not connected")
        return {
            "username": connection.get("username"),
            "account_number": connection.get("account_number"),
            "portfolio_value": connection.get("portfolio_value"),
            "cash_balance": connection.get("cash_balance"),
            "buying_power": connection.get("buying_power"),
            "total_equity": connection.get("total_equity"),
            "last_synced_at": connection.get("last_synced_at"),
            "profile": connection.get("profile") or {},
        }

    # Supabase / PostgREST applies a default ``max-rows`` cap of 1000 to any
    # SELECT that doesn't explicitly request a range. We compute PnL/wash-sale
    # by walking the user's full order history in chronological order, so we
    # MUST page through until we've actually fetched everything. Otherwise the
    # caller silently sees only the oldest 1000 orders and "newer" orders
    # disappear from the UI even though they're in the table.
    _ORDERS_PAGE_SIZE = 1000

    def _fetch_all_user_orders(
        self,
        user_id: str,
        symbol: str | None = None,
    ) -> List[Dict[str, Any]]:
        all_rows: List[Dict[str, Any]] = []
        offset = 0
        page_size = self._ORDERS_PAGE_SIZE
        while True:
            query = (
                self.supabase.table("robinhood_stock_orders")
                .select(
                    "id, order_id, ticker, side, order_type, quantity, average_price, "
                    "total_amount, state, created_time, executed_time, fees, raw_order"
                )
                .eq("user_id", user_id)
                .order("created_time", desc=False)
                .range(offset, offset + page_size - 1)
            )
            if symbol:
                query = query.eq("ticker", symbol.upper())
            result = query.execute()
            rows = result.data or []
            all_rows.extend(rows)
            if len(rows) < page_size:
                break
            offset += page_size
        return all_rows

    async def get_orders(
        self,
        user_id: str,
        limit: int = 100,
        offset: int = 0,
        symbol: str | None = None,
        status_filter: str = "filled",
    ) -> Dict[str, Any]:
        """Return synced Robinhood stock orders for the current user."""

        connection = await self._get_robinhood_connection(user_id)
        if not connection:
            return {
                "orders": [],
                "total": 0,
                "limit": limit,
                "offset": offset,
                "has_more": False,
                "wash_sale_risk_symbols": [],
            }

        avg_cost_map = self._get_avg_cost_map(user_id)
        all_rows = self._fetch_all_user_orders(user_id, symbol=symbol)
        enriched_orders = self._enrich_orders(all_rows, avg_cost_map)
        if status_filter and status_filter.lower() != "all":
            enriched_orders = [
                order
                for order in enriched_orders
                if _order_state_matches(order.get("state"), status_filter)
            ]
        total = len(enriched_orders)
        page = list(reversed(enriched_orders))[offset : offset + limit]

        return {
            "orders": page,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total,
            "wash_sale_risk_symbols": self._current_wash_sale_risk_symbols(
                enriched_orders
            ),
        }

    async def get_wash_sale_risk(self, user_id: str) -> Dict[str, Any]:
        connection = await self._get_robinhood_connection(user_id)
        if not connection:
            return {"symbols": [], "generated_at": datetime.utcnow().isoformat()}

        avg_cost_map = self._get_avg_cost_map(user_id)
        all_rows = self._fetch_all_user_orders(user_id)
        enriched = self._enrich_orders(all_rows, avg_cost_map)
        return {
            "symbols": self._current_wash_sale_risk_symbols(enriched),
            "generated_at": datetime.utcnow().isoformat(),
        }

    async def get_sell_performance(
        self,
        user_id: str,
        limit: int = 100,
        offset: int = 0,
        symbol: str | None = None,
    ) -> Dict[str, Any]:
        """Compare filled sells with current market prices.

        Positive opportunity P&L means the stock is above the user's sell price
        now (missed upside / sold too early). Negative means the stock is below
        the sell price now (the sale avoided further downside).
        """

        connection = await self._get_robinhood_connection(user_id)
        if not connection:
            return {
                "items": [],
                "summary": {
                    "total_sells": 0,
                    "sold_too_early_count": 0,
                    "good_sale_count": 0,
                    "unknown_count": 0,
                    "missed_upside_amount": 0.0,
                    "avoided_downside_amount": 0.0,
                },
                "total": 0,
                "limit": limit,
                "offset": offset,
                "has_more": False,
                "generated_at": datetime.utcnow().isoformat(),
            }

        avg_cost_map = self._get_avg_cost_map(user_id)
        all_rows = self._fetch_all_user_orders(user_id, symbol=symbol)
        enriched = self._enrich_orders(all_rows, avg_cost_map)
        sell_orders = [
            order
            for order in enriched
            if _safe_str(order.get("side")).lower() == "sell"
            and _safe_str(order.get("state")).lower() == "filled"
            and _safe_float(order.get("quantity")) > 0
            and _safe_float(order.get("average_price")) > 0
        ]
        sell_orders = sorted(
            sell_orders,
            key=lambda order: (
                _parse_order_datetime(order.get("executed_time") or order.get("created_time"))
                or datetime.min.replace(tzinfo=timezone.utc)
            ),
            reverse=True,
        )

        symbols = sorted({_safe_str(order.get("ticker")).upper() for order in sell_orders})
        quote_map: Dict[str, Dict[str, Any]] = {}
        yfinance = get_yfinance_service()
        for ticker in symbols:
            if not ticker:
                continue
            try:
                quote_map[ticker] = await asyncio.to_thread(yfinance.get_quote, ticker)
            except Exception as error:
                logger.warning("Could not fetch current quote for %s: %s", ticker, error)

        items: List[Dict[str, Any]] = []
        for order in sell_orders:
            ticker = _safe_str(order.get("ticker")).upper()
            sell_price = _safe_float(order.get("average_price"))
            quantity = _safe_float(order.get("quantity"))
            quote = quote_map.get(ticker, {})
            current_price = _safe_float(quote.get("current_price"), default=0.0)
            price_change = current_price - sell_price if current_price > 0 else None
            price_change_percent = (
                round((price_change / sell_price) * 100, 2)
                if price_change is not None and sell_price > 0
                else None
            )
            opportunity_pnl = (
                round(price_change * quantity, 2)
                if price_change is not None
                else None
            )
            if opportunity_pnl is None:
                verdict = "unknown"
            elif opportunity_pnl > 0:
                verdict = "sold_too_early"
            elif opportunity_pnl < 0:
                verdict = "good_sale"
            else:
                verdict = "flat"

            items.append(
                {
                    "order_id": order.get("order_id"),
                    "ticker": ticker,
                    "sell_time": order.get("executed_time") or order.get("created_time"),
                    "quantity": quantity,
                    "sell_price": sell_price,
                    "current_price": current_price if current_price > 0 else None,
                    "price_change": round(price_change, 4) if price_change is not None else None,
                    "price_change_percent": price_change_percent,
                    "opportunity_pnl": opportunity_pnl,
                    "realized_pnl": order.get("realized_pnl"),
                    "realized_pnl_percent": order.get("realized_pnl_percent"),
                    "verdict": verdict,
                    "message": self._sell_performance_message(
                        verdict=verdict,
                        ticker=ticker,
                        opportunity_pnl=opportunity_pnl,
                        price_change_percent=price_change_percent,
                    ),
                }
            )

        missed = [
            _safe_float(item.get("opportunity_pnl"))
            for item in items
            if item.get("opportunity_pnl") is not None and _safe_float(item.get("opportunity_pnl")) > 0
        ]
        avoided = [
            abs(_safe_float(item.get("opportunity_pnl")))
            for item in items
            if item.get("opportunity_pnl") is not None and _safe_float(item.get("opportunity_pnl")) < 0
        ]
        total = len(items)
        page = items[offset : offset + limit]
        return {
            "items": page,
            "summary": {
                "total_sells": total,
                "sold_too_early_count": len([item for item in items if item["verdict"] == "sold_too_early"]),
                "good_sale_count": len([item for item in items if item["verdict"] == "good_sale"]),
                "unknown_count": len([item for item in items if item["verdict"] == "unknown"]),
                "missed_upside_amount": round(sum(missed), 2),
                "avoided_downside_amount": round(sum(avoided), 2),
            },
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total,
            "generated_at": datetime.utcnow().isoformat(),
        }

    def _sell_performance_message(
        self,
        verdict: str,
        ticker: str,
        opportunity_pnl: float | None,
        price_change_percent: float | None,
    ) -> str:
        if verdict == "sold_too_early":
            return (
                f"{ticker} is above your sell price now. Missed upside is about "
                f"${abs(opportunity_pnl or 0):,.2f} ({price_change_percent:.2f}%)."
            )
        if verdict == "good_sale":
            return (
                f"{ticker} is below your sell price now. The sale avoided about "
                f"${abs(opportunity_pnl or 0):,.2f} of further downside."
            )
        if verdict == "flat":
            return f"{ticker} is almost unchanged from your sell price."
        return f"Current quote is unavailable for {ticker}."

    async def analyze_orders(
        self,
        user_id: str,
        provider: str,
        model: str,
        user_api_keys: dict[str, str] | None = None,
        limit: int = 200,
        order_ids: list[str] | None = None,
        language: str = "zh",
    ) -> Dict[str, Any]:
        avg_cost_map = self._get_avg_cost_map(user_id)
        if order_ids:
            all_rows = self._fetch_all_user_orders(user_id)
            enriched_history = self._enrich_orders(all_rows, avg_cost_map)
            selected = set(order_ids)
            orders = [
                order
                for order in enriched_history
                if order.get("order_id") in selected or order.get("id") in selected
            ]
            risk_symbols = self._current_wash_sale_risk_symbols(enriched_history)
        else:
            orders_payload = await self.get_orders(user_id, limit=limit, offset=0)
            orders = orders_payload["orders"]
            risk_symbols = orders_payload.get("wash_sale_risk_symbols", [])
        if not orders:
            raise Exception("No Robinhood orders available to analyze")

        compact_orders = [
            {
                "date": order.get("executed_time") or order.get("created_time"),
                "ticker": order.get("ticker"),
                "side": order.get("side"),
                "quantity": order.get("quantity"),
                "average_price": order.get("average_price"),
                "total_amount": order.get("total_amount"),
                "realized_pnl": order.get("realized_pnl"),
                "wash_sale_flag": order.get("wash_sale_flag"),
                "state": order.get("state"),
            }
            for order in orders[:limit]
        ]
        summary = self._orders_summary(orders)

        llm = get_llm(
            provider=provider,
            model=model,
            temperature=0.2,
            user_api_keys=user_api_keys,
        )
        messages = [
            SystemMessage(
                content=(
                    "You are a disciplined trading journal coach. Analyze the user's "
                    "Robinhood order history. Be specific, practical, and concise. "
                    "Do not give personalized tax advice; flag wash sale risk as "
                    "informational only and recommend consulting a tax professional. "
                    "Return well-structured GitHub-flavored Markdown."
                )
            ),
            HumanMessage(
                content=(
                    "Analyze these trades. Return markdown with sections: "
                    "Summary, Best Trades, Worst Trades, Behavioral Patterns, "
                    "Risk Controls, Wash Sale Notes, Next Actions. "
                    f"Write the entire analysis in {'Chinese' if language == 'zh' else 'English'}.\n\n"
                    f"Summary: {json.dumps(summary, default=str)}\n"
                    f"Current wash-sale-risk symbols: {json.dumps(risk_symbols, default=str)}\n"
                    f"Orders: {json.dumps(compact_orders, default=str)}"
                )
            ),
        ]
        response = await asyncio.to_thread(llm.invoke, messages)
        content = getattr(response, "content", str(response))
        return {
            "analysis": content,
            "provider": provider,
            "model": model,
            "orders_analyzed": len(compact_orders),
            "generated_at": datetime.utcnow().isoformat(),
        }

    def _orders_summary(self, orders: List[Dict[str, Any]]) -> Dict[str, Any]:
        realized = [
            _safe_float(order.get("realized_pnl"))
            for order in orders
            if order.get("realized_pnl") is not None
        ]
        return {
            "orders_count": len(orders),
            "realized_pnl": round(sum(realized), 2),
            "winning_sells": len([pnl for pnl in realized if pnl > 0]),
            "losing_sells": len([pnl for pnl in realized if pnl < 0]),
            "wash_sale_flags": len(
                [order for order in orders if order.get("wash_sale_flag")]
            ),
        }

    def _get_avg_cost_map(self, user_id: str) -> Dict[str, float]:
        """Return {TICKER: average_purchase_price} from synced positions.

        Robinhood's ``average_buy_price`` reflects the true weighted average
        cost across all tax lots for a holding, so using it as the cost basis
        for sell P&L is more accurate than replaying orders with FIFO — the
        user may have sold specific lots via the Robinhood UI.
        """
        try:
            result = (
                self.supabase.table("snaptrade_positions")
                .select("symbol, average_purchase_price")
                .execute()
            )
            return {
                _safe_str(row.get("symbol")).upper(): _safe_float(
                    row.get("average_purchase_price")
                )
                for row in (result.data or [])
                if row.get("symbol") and _safe_float(row.get("average_purchase_price")) > 0
            }
        except Exception as err:
            logger.warning("Could not load avg cost map: %s", err)
            return {}

    def _enrich_orders(
        self,
        rows: List[Dict[str, Any]],
        avg_cost_map: Dict[str, float] | None = None,
    ) -> List[Dict[str, Any]]:
        """Attach realized P&L and wash-sale flags to order rows.

        Cost basis strategy (in priority order):
          1. **Robinhood average cost** – if ``avg_cost_map`` contains the
             ticker we use ``average_buy_price × quantity`` as cost basis.
             This matches what the user sees in the Robinhood app and
             respects specific-lot / tax-lot selling.
          2. **FIFO fallback** – if no average cost is available (e.g. the
             position has been fully closed) we replay buy lots in
             chronological order.
        """
        if avg_cost_map is None:
            avg_cost_map = {}

        rows = sorted(
            rows,
            key=lambda row: (
                _parse_order_datetime(row.get("executed_time") or row.get("created_time"))
                or datetime.min.replace(tzinfo=timezone.utc)
            ),
        )
        lots: dict[str, deque[dict[str, float]]] = defaultdict(deque)
        enriched: List[Dict[str, Any]] = []
        buys_by_symbol: dict[str, List[datetime]] = defaultdict(list)

        for row in rows:
            order = dict(row)
            ticker = _safe_str(order.get("ticker")).upper()
            side = _safe_str(order.get("side")).lower()
            state = _safe_str(order.get("state")).lower()
            quantity = _safe_float(order.get("quantity"))
            price = _safe_float(order.get("average_price"))
            order_dt = _parse_order_datetime(
                order.get("executed_time") or order.get("created_time")
            )

            order["realized_pnl"] = None
            order["realized_pnl_percent"] = None
            order["wash_sale_flag"] = False
            order["wash_sale_reason"] = None

            if state != "filled" or not ticker or not order_dt or quantity <= 0 or price <= 0:
                enriched.append(order)
                continue

            if side == "buy":
                lots[ticker].append({"quantity": quantity, "price": price})
                buys_by_symbol[ticker].append(order_dt)
            elif side == "sell":
                avg_cost = avg_cost_map.get(ticker, 0.0)
                if avg_cost > 0:
                    # Use Robinhood's own average cost (reflects tax-lot selection)
                    cost_basis = quantity * avg_cost
                else:
                    # Fallback: FIFO lot matching
                    remaining = quantity
                    cost_basis = 0.0
                    while remaining > 0 and lots[ticker]:
                        lot = lots[ticker][0]
                        matched = min(remaining, lot["quantity"])
                        cost_basis += matched * lot["price"]
                        lot["quantity"] -= matched
                        remaining -= matched
                        if lot["quantity"] <= 1e-9:
                            lots[ticker].popleft()
                    if remaining > 0:
                        cost_basis += remaining * price

                proceeds = quantity * price
                realized_pnl = proceeds - cost_basis
                order["cost_basis"] = round(cost_basis, 4)
                order["realized_pnl"] = round(realized_pnl, 4)
                order["realized_pnl_percent"] = (
                    round((realized_pnl / cost_basis) * 100, 2)
                    if cost_basis > 0
                    else None
                )
            enriched.append(order)

        # Wash-sale detection
        for order in enriched:
            ticker = _safe_str(order.get("ticker")).upper()
            side = _safe_str(order.get("side")).lower()
            order_dt = _parse_order_datetime(
                order.get("executed_time") or order.get("created_time")
            )
            if side == "sell" and _safe_float(order.get("realized_pnl")) < 0 and order_dt:
                replacement_buys = [
                    buy_dt
                    for buy_dt in buys_by_symbol.get(ticker, [])
                    if abs((buy_dt - order_dt).days) <= 30
                ]
                if replacement_buys:
                    order["wash_sale_flag"] = True
                    order["wash_sale_reason"] = (
                        "Loss sale with replacement buy within +/-30 days"
                    )

        return enriched

    def _current_wash_sale_risk_symbols(
        self,
        enriched_orders: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        risks: dict[str, Dict[str, Any]] = {}
        for order in enriched_orders:
            if _safe_str(order.get("side")).lower() != "sell":
                continue
            realized_pnl = order.get("realized_pnl")
            if realized_pnl is None or _safe_float(realized_pnl) >= 0:
                continue
            order_dt = _parse_order_datetime(
                order.get("executed_time") or order.get("created_time")
            )
            if not order_dt:
                continue
            days_since = (now - order_dt).days
            if 0 <= days_since <= 30:
                ticker = _safe_str(order.get("ticker")).upper()
                expires_at = order_dt + timedelta(days=31)
                current = risks.get(ticker)
                if not current or expires_at > _parse_order_datetime(
                    current.get("risk_expires_at")
                ):
                    risks[ticker] = {
                        "ticker": ticker,
                        "last_loss_sale_at": order_dt.isoformat(),
                        "risk_expires_at": expires_at.isoformat(),
                        "days_remaining": max(0, 31 - days_since),
                        "loss_amount": abs(_safe_float(realized_pnl)),
                    }
        return sorted(risks.values(), key=lambda item: item["ticker"])

    async def disconnect(self, user_id: str) -> bool:
        portfolio_connection = (
            self.supabase.table("snaptrade_connections")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )

        account = await self._get_portfolio_account(user_id)
        if account:
            self.supabase.table("snaptrade_accounts").delete().eq(
                "id", account["id"]
            ).execute()

        self.supabase.table("robinhood_stock_orders").delete().eq(
            "user_id", user_id
        ).execute()
        # Clear cached OAuth tokens (DB row + pickle file) before deleting the
        # connection row so we don't leave a stale pickle on the filesystem.
        self.reset_login_state(user_id)
        self.supabase.table("robinhood_connections").delete().eq(
            "user_id", user_id
        ).execute()

        if portfolio_connection.data:
            connection = portfolio_connection.data[0]
            remaining_accounts = (
                self.supabase.table("snaptrade_accounts")
                .select("id", count="exact")
                .eq("connection_id", connection["id"])
                .execute()
            )
            if (remaining_accounts.count or 0) == 0 and str(
                connection.get("snaptrade_user_id", "")
            ).startswith("robinhood_"):
                self.supabase.table("snaptrade_connections").delete().eq(
                    "id", connection["id"]
                ).execute()

        return True

    async def _fetch_profile(self) -> Dict[str, Any]:
        profile = await asyncio.to_thread(r.build_user_profile)
        account_profile = await asyncio.to_thread(r.profiles.load_account_profile)
        if isinstance(account_profile, dict):
            profile = {**account_profile, **profile}
        return profile or {}

    async def _upsert_robinhood_connection(
        self,
        user_id: str,
        username: str,
        profile: Dict[str, Any],
    ) -> Dict[str, Any]:
        data = {
            "user_id": user_id,
            "username": username,
            "session_pickle_name": self._session_name(user_id),
            "device_token": self._get_or_create_device_token(user_id, username),
            "pending_challenge_id": None,
            "is_connected": True,
            "last_synced_at": datetime.utcnow().isoformat(),
            "profile": profile,
            "account_number": profile.get("account_number"),
            "portfolio_value": _safe_float(profile.get("equity")),
            "cash_balance": _safe_float(profile.get("cash")),
            "buying_power": _safe_float(profile.get("buying_power")),
            "total_equity": _safe_float(profile.get("equity")),
        }
        result = (
            self.supabase.table("robinhood_connections")
            .upsert(data, on_conflict="user_id")
            .execute()
        )
        return result.data[0] if result.data else data

    async def _ensure_portfolio_connection(self, user_id: str) -> Dict[str, Any]:
        result = (
            self.supabase.table("snaptrade_connections")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        if result.data:
            return result.data[0]

        data = {
            "user_id": user_id,
            "snaptrade_user_id": f"robinhood_{user_id}",
            "snaptrade_user_secret": "managed_by_robinhood_integration",
            "is_connected": True,
            "is_public": False,
            "last_synced_at": datetime.utcnow().isoformat(),
        }
        created = self.supabase.table("snaptrade_connections").insert(data).execute()
        if not created.data:
            raise Exception("Failed to create portfolio connection")
        return created.data[0]

    async def _upsert_portfolio_account(
        self,
        connection_id: str,
        user_id: str,
        profile: Dict[str, Any],
    ) -> Dict[str, Any]:
        account_id = f"robinhood:{user_id}"
        data = {
            "connection_id": connection_id,
            "account_id": account_id,
            "brokerage_name": "Robinhood",
            "account_name": "Robinhood",
            "account_number": profile.get("account_number"),
            "account_type": profile.get("type") or "brokerage",
        }
        result = (
            self.supabase.table("snaptrade_accounts")
            .upsert(data, on_conflict="connection_id,account_id")
            .execute()
        )
        if not result.data:
            raise Exception("Failed to upsert Robinhood account")
        return result.data[0]

    async def _sync_positions(
        self,
        account_id: str,
        holdings_data: Dict[str, Dict[str, Any]],
        option_positions_data: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        synced_positions: List[Dict[str, Any]] = []
        synced_keys: Set[str] = set()
        option_positions_loaded = option_positions_data is not None

        for ticker, data in holdings_data.items():
            quantity = _safe_float(data.get("quantity"))
            price = _safe_float(data.get("price"))
            average_price = _safe_float(data.get("average_buy_price"))
            open_pnl = _safe_float(data.get("equity_change"))
            position = {
                "account_id": account_id,
                "position_type": "equity",
                "symbol": ticker,
                "symbol_id": data.get("id"),
                "security_name": data.get("name") or ticker,
                "units": quantity,
                "price": price,
                "open_pnl": open_pnl,
                "fractional_units": quantity,
                "average_purchase_price": average_price,
                "currency": "USD",
            }
            result = (
                self.supabase.table("snaptrade_positions")
                .upsert(position, on_conflict="account_id,symbol,position_type")
                .execute()
            )
            if result.data:
                synced_positions.append(result.data[0])
            synced_keys.add(f"{ticker}:equity")

        option_instrument_cache: Dict[str, Dict[str, Any]] = {}
        option_market_cache: Dict[str, Dict[str, Any]] = {}

        option_synced_count = 0
        option_skipped_count = 0
        for raw_position in option_positions_data or []:
            try:
                quantity = _safe_float(raw_position.get("quantity"))
                if quantity == 0:
                    option_skipped_count += 1
                    continue

                option_url = _safe_str(
                    raw_position.get("option") or raw_position.get("instrument")
                )
                option_id = _option_id_from_url(option_url)
                if not option_id:
                    logger.warning(
                        "Skipping Robinhood option position without option id: %s",
                        {k: v for k, v in raw_position.items() if k != "raw_order"},
                    )
                    option_skipped_count += 1
                    continue

                if option_id not in option_instrument_cache:
                    instrument = None
                    try:
                        if option_url:
                            instrument = await asyncio.to_thread(request_get, option_url)
                        if not instrument:
                            instrument = await asyncio.to_thread(
                                r.get_option_instrument_data_by_id, option_id
                            )
                    except Exception as error:
                        logger.warning(
                            "Failed to fetch option instrument %s: %s",
                            option_id,
                            error,
                        )
                        instrument = {}
                    option_instrument_cache[option_id] = instrument or {}

                if option_id not in option_market_cache:
                    market_data = {}
                    try:
                        raw_market_data = await asyncio.to_thread(
                            r.get_option_market_data_by_id, option_id
                        )
                        if isinstance(raw_market_data, list) and raw_market_data:
                            market_data = raw_market_data[0] or {}
                        elif isinstance(raw_market_data, dict):
                            market_data = raw_market_data
                    except Exception as error:
                        logger.warning(
                            "Failed to fetch option market data %s: %s",
                            option_id,
                            error,
                        )
                    option_market_cache[option_id] = market_data

                instrument_data = option_instrument_cache.get(option_id, {})
                market_data = option_market_cache.get(option_id, {})
                underlying = _safe_str(
                    instrument_data.get("chain_symbol")
                    or raw_position.get("chain_symbol")
                    or raw_position.get("symbol")
                ).upper()
                option_type = _safe_str(
                    instrument_data.get("type") or raw_position.get("option_type")
                ).lower()
                expiration = instrument_data.get("expiration_date") or raw_position.get(
                    "expiration_date"
                )
                strike = _safe_float(
                    instrument_data.get("strike_price") or raw_position.get("strike_price")
                )
                contract_symbol = _safe_str(
                    market_data.get("symbol")
                    or market_data.get("instrument")
                    or f"{underlying} {expiration} {strike:g} {option_type.upper()}"
                )
                side = _safe_str(raw_position.get("type") or raw_position.get("side")).lower()
                signed_quantity = -quantity if side == "short" else quantity
                mark_price = _safe_float(
                    market_data.get("adjusted_mark_price")
                    or market_data.get("mark_price")
                    or market_data.get("last_trade_price")
                    or raw_position.get("price")
                )
                average_price = _safe_float(
                    raw_position.get("average_price")
                    or raw_position.get("average_open_price")
                    or raw_position.get("average_purchase_price")
                )
                average_purchase_price = average_price * 100 if average_price else None
                security_name = " ".join(
                    str(part)
                    for part in [
                        underlying,
                        expiration,
                        f"${strike:g}" if strike else None,
                        option_type.upper() if option_type else None,
                    ]
                    if part
                )

                position = {
                    "account_id": account_id,
                    "position_type": "option",
                    "symbol": contract_symbol,
                    "symbol_id": option_id,
                    "security_name": security_name or contract_symbol,
                    "units": signed_quantity,
                    "price": mark_price,
                    "open_pnl": None,
                    "fractional_units": signed_quantity,
                    "average_purchase_price": average_purchase_price,
                    "currency": "USD",
                    "option_type": option_type or None,
                    "strike_price": strike or None,
                    "expiration_date": expiration,
                    "underlying_symbol": underlying or None,
                }
                result = (
                    self.supabase.table("snaptrade_positions")
                    .upsert(position, on_conflict="account_id,symbol,position_type")
                    .execute()
                )
                if result.data:
                    synced_positions.append(result.data[0])
                    option_synced_count += 1
                synced_keys.add(f"{contract_symbol}:option")
            except Exception as option_error:
                logger.error(
                    "Failed to sync option position: %s (raw keys: %s)",
                    option_error,
                    list(raw_position.keys()),
                    exc_info=True,
                )
                option_skipped_count += 1

        if option_positions_loaded:
            logger.info(
                "Option positions sync: %d synced, %d skipped (zero qty / missing id) out of %d raw",
                option_synced_count,
                option_skipped_count,
                len(option_positions_data or []),
            )

        existing = (
            self.supabase.table("snaptrade_positions")
            .select("id, symbol, position_type")
            .eq("account_id", account_id)
            .execute()
        )
        for pos in existing.data or []:
            key = f"{pos.get('symbol')}:{pos.get('position_type', 'equity')}"
            if pos.get("position_type") == "option" and not option_positions_loaded:
                continue
            if key not in synced_keys:
                self.supabase.table("snaptrade_positions").delete().eq(
                    "id", pos["id"]
                ).execute()

        return synced_positions

    async def _sync_orders(self, user_id: str) -> int:
        """Incremental + batched Robinhood order sync.

        Robinhood `/orders/` returns newest first across many paginated pages.
        Doing a per-order Supabase upsert (plus an instrument→ticker lookup)
        for every page on every sync easily blows past the 60s API gateway
        cap once an account accumulates several hundred orders, which then
        looks like "the latest trades aren't coming through" because the
        request times out before the first batch finishes writing.

        To keep syncs fast and idempotent we:
          1. Pull every existing order_id + state from Supabase up front.
          2. Skip Robinhood rows that already exist in a terminal state and
             whose state hasn't changed -- the row in our table is already
             correct, no upsert / no instrument lookup needed.
          3. Resolve unique instrument URLs via Robinhood **once each**.
          4. Batch-upsert the changed/new rows 100 at a time.
        """

        try:
            orders_data = await asyncio.to_thread(r.get_all_stock_orders)
        except Exception as error:
            logger.exception(
                "Robinhood order list fetch failed for user %s: %s",
                user_id,
                error,
            )
            return 0

        if not orders_data:
            logger.info("Robinhood returned no orders for user %s", user_id)
            return 0

        # --- Existing orders snapshot ------------------------------------
        existing_states: Dict[str, str] = {}
        existing_tickers: Dict[str, str] = {}
        existing_has_time: Set[str] = set()
        try:
            existing_rows = (
                self.supabase.table("robinhood_stock_orders")
                .select("order_id, state, ticker, created_time, executed_time")
                .eq("user_id", user_id)
                .execute()
            )
            for row in existing_rows.data or []:
                order_id_value = row.get("order_id")
                if not order_id_value:
                    continue
                existing_states[order_id_value] = _safe_str(
                    row.get("state")
                ).lower()
                existing_tickers[order_id_value] = _safe_str(row.get("ticker"))
                if row.get("created_time") or row.get("executed_time"):
                    existing_has_time.add(order_id_value)
        except Exception as snapshot_error:
            logger.warning(
                "Could not load existing Robinhood orders for user %s, "
                "falling back to full upsert: %s",
                user_id,
                snapshot_error,
            )

        terminal_states = {"filled", "cancelled", "canceled", "rejected", "failed"}
        symbol_cache: Dict[str, str] = {}
        rows_to_upsert: List[Dict[str, Any]] = []
        unchanged = 0
        skipped = 0
        instrument_lookups_needed: Set[str] = set()

        # --- First pass: figure out what actually changed -----------------
        candidate_orders: List[Dict[str, Any]] = []
        for raw_order in orders_data:
            order_id = raw_order.get("id")
            instrument_url = raw_order.get("instrument")
            if not order_id or not instrument_url:
                skipped += 1
                continue

            new_state = _safe_str(raw_order.get("state")).lower()
            prev_state = existing_states.get(order_id)
            already_has_time = order_id in existing_has_time
            if (
                prev_state is not None
                and prev_state == new_state
                and prev_state in terminal_states
                and already_has_time
            ):
                # Row is already terminal in our table, Robinhood agrees,
                # and timestamps are present. Cache the ticker so we don't
                # have to hit the instrument endpoint again this sync.
                cached_ticker = existing_tickers.get(order_id)
                if cached_ticker and cached_ticker != "UNKNOWN":
                    symbol_cache[instrument_url] = cached_ticker
                unchanged += 1
                continue

            candidate_orders.append(raw_order)
            if instrument_url not in symbol_cache:
                instrument_lookups_needed.add(instrument_url)

        # --- Resolve instrument URLs once each ---------------------------
        for instrument_url in instrument_lookups_needed:
            try:
                ticker = await asyncio.to_thread(
                    r.get_symbol_by_url, instrument_url
                )
                if ticker:
                    symbol_cache[instrument_url] = ticker
            except Exception as lookup_error:
                logger.warning(
                    "Robinhood symbol lookup failed for %s: %s",
                    instrument_url,
                    lookup_error,
                )

        # --- Build rows --------------------------------------------------
        failed = 0
        for raw_order in candidate_orders:
            order_id = raw_order.get("id")
            instrument_url = raw_order.get("instrument")
            try:
                quantity = _safe_float(
                    raw_order.get("cumulative_quantity")
                    or raw_order.get("quantity")
                )
                average_price = _safe_float(raw_order.get("average_price"))

                rows_to_upsert.append(
                    {
                        "user_id": user_id,
                        "order_id": order_id,
                        "ticker": symbol_cache.get(instrument_url) or "UNKNOWN",
                        "side": _safe_str(raw_order.get("side")),
                        "order_type": _safe_str(raw_order.get("type")),
                        "quantity": quantity,
                        "average_price": (
                            average_price if average_price > 0 else None
                        ),
                        "total_amount": quantity * average_price,
                        "state": _safe_str(raw_order.get("state")),
                        "created_time": _parse_robinhood_timestamp(
                            raw_order.get("created_at")
                        ),
                        "executed_time": _parse_robinhood_timestamp(
                            raw_order.get("last_transaction_at")
                        ),
                        "fees": _safe_float(raw_order.get("fees")),
                        "raw_order": raw_order,
                    }
                )
            except Exception as build_error:
                failed += 1
                logger.warning(
                    "Failed to build Robinhood order payload %s for user %s: %s",
                    order_id,
                    user_id,
                    build_error,
                )

        # --- Batched upsert ----------------------------------------------
        synced = 0
        batch_size = 100
        for i in range(0, len(rows_to_upsert), batch_size):
            batch = rows_to_upsert[i : i + batch_size]
            try:
                self.supabase.table("robinhood_stock_orders").upsert(
                    batch, on_conflict="user_id,order_id"
                ).execute()
                synced += len(batch)
            except Exception as batch_error:
                failed += len(batch)
                logger.warning(
                    "Robinhood batch upsert failed (%d rows) for user %s: %s",
                    len(batch),
                    user_id,
                    batch_error,
                )

        logger.info(
            "Robinhood orders sync for user %s: synced=%d unchanged=%d "
            "skipped=%d failed=%d total=%d",
            user_id,
            synced,
            unchanged,
            skipped,
            failed,
            len(orders_data),
        )
        return synced

    async def _sync_option_orders(self, user_id: str) -> int:
        """Sync Robinhood option order legs."""

        try:
            orders_data = await asyncio.to_thread(r.get_all_option_orders)
        except Exception as error:
            logger.warning(
                "Robinhood option order list fetch failed for user %s: %s",
                user_id,
                error,
            )
            return 0

        if not orders_data:
            return 0

        instrument_cache: Dict[str, Dict[str, Any]] = {}
        rows_to_upsert: List[Dict[str, Any]] = []

        for raw_order in orders_data:
            option_order_id = _safe_str(raw_order.get("id"))
            if not option_order_id:
                continue
            legs = raw_order.get("legs") or []
            if not isinstance(legs, list) or not legs:
                legs = [{}]

            for index, leg in enumerate(legs):
                if not isinstance(leg, dict):
                    leg = {}
                option_url = leg.get("option") or leg.get("option_instrument")
                instrument_data: Dict[str, Any] = {}
                if option_url:
                    option_url_key = str(option_url)
                    if option_url_key not in instrument_cache:
                        try:
                            instrument_cache[option_url_key] = await asyncio.to_thread(
                                request_get, option_url_key
                            )
                        except Exception as error:
                            logger.debug(
                                "Could not resolve option instrument %s: %s",
                                option_url_key,
                                error,
                            )
                            instrument_cache[option_url_key] = {}
                    instrument_data = instrument_cache[option_url_key]

                option_id = _option_id_from_url(option_url)
                leg_id = _safe_str(leg.get("id")) or option_id or f"{option_order_id}:{index}"
                processed_quantity = _safe_float(
                    raw_order.get("processed_quantity") or raw_order.get("quantity")
                )
                price = _safe_float(raw_order.get("price"))
                premium = processed_quantity * price * 100 if price > 0 else 0.0
                chain_symbol = _safe_str(raw_order.get("chain_symbol"))
                underlying_symbol = (
                    chain_symbol or _safe_str(instrument_data.get("chain_symbol"))
                )

                rows_to_upsert.append(
                    {
                        "user_id": user_id,
                        "option_order_id": option_order_id,
                        "leg_id": leg_id,
                        "chain_symbol": chain_symbol or None,
                        "underlying_symbol": underlying_symbol or None,
                        "option_type": _safe_str(
                            instrument_data.get("type") or leg.get("option_type")
                        )
                        or None,
                        "expiration_date": instrument_data.get("expiration_date"),
                        "strike_price": _safe_float(instrument_data.get("strike_price")),
                        "side": _safe_str(leg.get("side") or raw_order.get("side")),
                        "direction": _safe_str(raw_order.get("direction")),
                        "opening_strategy": _safe_str(raw_order.get("opening_strategy")),
                        "closing_strategy": _safe_str(raw_order.get("closing_strategy")),
                        "order_type": _safe_str(raw_order.get("type")),
                        "quantity": _safe_float(raw_order.get("quantity")),
                        "processed_quantity": processed_quantity,
                        "price": price if price > 0 else None,
                        "premium": premium,
                        "state": _safe_str(raw_order.get("state")),
                        "created_time": _parse_robinhood_timestamp(
                            raw_order.get("created_at")
                        ),
                        "executed_time": _parse_robinhood_timestamp(
                            raw_order.get("updated_at")
                            or raw_order.get("processed_at")
                            or raw_order.get("last_transaction_at")
                        ),
                        "raw_order": raw_order,
                        "raw_leg": leg,
                    }
                )

        if not rows_to_upsert:
            return 0

        try:
            for start in range(0, len(rows_to_upsert), 100):
                self.supabase.table("robinhood_option_orders").upsert(
                    rows_to_upsert[start : start + 100],
                    on_conflict="user_id,option_order_id,leg_id",
                ).execute()
        except Exception as error:
            if _is_missing_robinhood_table_error(error):
                raise RobinhoodStorageNotReady(
                    "Robinhood option order migration has not been applied."
                ) from error
            raise

        logger.info(
            "Synced %s Robinhood option order legs for user %s",
            len(rows_to_upsert),
            user_id,
        )
        return len(rows_to_upsert)

    async def get_option_orders(
        self,
        user_id: str,
        limit: int = 100,
        offset: int = 0,
        symbol: str | None = None,
        status_filter: str = "filled",
    ) -> Dict[str, Any]:
        connection = await self._get_robinhood_connection(user_id)
        if not connection:
            return {
                "orders": [],
                "total": 0,
                "limit": limit,
                "offset": offset,
                "has_more": False,
            }

        try:
            query = (
                self.supabase.table("robinhood_option_orders")
                .select("*", count="exact")
                .eq("user_id", user_id)
                .order("created_time", desc=True)
            )
            if symbol:
                query = query.eq("underlying_symbol", symbol.upper())
            if status_filter and status_filter.lower() != "all":
                query = query.eq("state", status_filter)
            result = query.range(offset, offset + limit - 1).execute()
        except Exception as error:
            if _is_missing_robinhood_table_error(error):
                raise RobinhoodStorageNotReady(
                    "Robinhood option order migration has not been applied."
                ) from error
            raise

        return {
            "orders": result.data or [],
            "total": result.count or 0,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < (result.count or 0),
        }

    async def _record_snapshot(
        self,
        user_id: str,
        positions: List[Dict[str, Any]],
    ) -> None:
        total_value = 0.0
        total_cost_basis = 0.0
        total_pnl = 0.0
        snapshot_positions: List[Dict[str, Any]] = []

        for pos in positions:
            units = _safe_float(pos.get("units"))
            price = _safe_float(pos.get("price"))
            average_price = _safe_float(pos.get("average_purchase_price"))
            value = units * price
            cost_basis = units * average_price
            pnl = _safe_float(pos.get("open_pnl"), value - cost_basis)

            total_value += value
            total_cost_basis += cost_basis
            total_pnl += pnl
            snapshot_positions.append(
                {
                    "symbol": pos.get("symbol"),
                    "units": units,
                    "price": price,
                    "market_value": round(value, 2),
                    "open_pnl": pnl,
                }
            )

        await get_portfolio_snapshot_service().record_snapshot(
            user_id=user_id,
            total_value=total_value,
            total_cost_basis=total_cost_basis,
            unrealized_pnl=total_pnl,
            positions_count=len(positions),
            accounts_count=1 if positions else 0,
            positions_snapshot=snapshot_positions,
            snapshot_date=date.today(),
        )

    async def _get_robinhood_connection(self, user_id: str) -> Optional[Dict[str, Any]]:
        try:
            result = (
                self.supabase.table("robinhood_connections")
                .select("*")
                .eq("user_id", user_id)
                .execute()
            )
        except Exception as error:
            if _is_missing_robinhood_table_error(error):
                raise RobinhoodStorageNotReady(
                    "Robinhood database migration has not been applied."
                ) from error
            raise
        return result.data[0] if result.data else None

    async def _get_portfolio_account(self, user_id: str) -> Optional[Dict[str, Any]]:
        connection = (
            self.supabase.table("snaptrade_connections")
            .select("id")
            .eq("user_id", user_id)
            .execute()
        )
        if not connection.data:
            return None

        account = (
            self.supabase.table("snaptrade_accounts")
            .select("*")
            .eq("connection_id", connection.data[0]["id"])
            .eq("account_id", f"robinhood:{user_id}")
            .execute()
        )
        return account.data[0] if account.data else None


def get_robinhood_service() -> RobinhoodService:
    return RobinhoodService()
