"""Robinhood integration service backed by Supabase portfolio tables."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import pickle
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

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
from app.services.portfolio_snapshot_service import get_portfolio_snapshot_service

logger = logging.getLogger(__name__)

_sync_locks: Dict[str, asyncio.Lock] = {}


class RobinhoodStorageNotReady(Exception):
    """Raised when the Robinhood Supabase migration has not been applied."""


class RobinhoodLoginApprovalRequired(Exception):
    """Raised when Robinhood requires mobile/app approval before login can continue."""


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


def _parse_robinhood_timestamp(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).isoformat()
    except ValueError:
        return None


def _is_missing_robinhood_table_error(error: Exception) -> bool:
    message = str(error).lower()
    return (
        "robinhood_connections" in message
        or "robinhood_stock_orders" in message
        or "could not find the table" in message
        or ("relation" in message and "does not exist" in message)
    )


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

            device_token = self._get_device_token(user_id)
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
        r.login(store_session=True, pickle_name=self._session_name(user_id))

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

        pickle_path = self._pickle_path(user_id)
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

        if pickle_path.exists():
            try:
                with pickle_path.open("rb") as f:
                    pickle_data = pickle.load(f)
                access_token = pickle_data["access_token"]
                token_type = pickle_data["token_type"]
                refresh_token = pickle_data["refresh_token"]
                payload["device_token"] = pickle_data.get("device_token") or payload[
                    "device_token"
                ]
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
                    "detail": f"logged in using authentication in {pickle_path.name}",
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
                with pickle_path.open("wb") as f:
                    pickle.dump(
                        {
                            "token_type": data["token_type"],
                            "access_token": data["access_token"],
                            "refresh_token": data["refresh_token"],
                            "device_token": payload["device_token"],
                        },
                        f,
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

        with pickle_path.open("wb") as f:
            pickle.dump(
                {
                    "token_type": data["token_type"],
                    "access_token": data["access_token"],
                    "refresh_token": data["refresh_token"],
                    "device_token": payload["device_token"],
                },
                f,
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
        """Login once, cache the token, sync profile/holdings/orders, and return status."""

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
            positions = await self._sync_unlocked(user_id, profile=profile)
            return {
                "success": True,
                "is_connected": True,
                "last_synced_at": connection.get("last_synced_at"),
                "profile": profile,
                "positions_synced": len(positions),
            }

    async def sync(
        self,
        user_id: str,
        profile: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Sync Robinhood account summary, positions, orders, and daily snapshot."""

        async with _get_user_lock(user_id):
            return await self._sync_unlocked(user_id, profile=profile)

    async def _sync_unlocked(
        self,
        user_id: str,
        profile: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        connection = await self._get_robinhood_connection(user_id)
        if not connection:
            raise Exception("Robinhood is not connected")

        await asyncio.to_thread(self._login_from_cache, user_id)

        if profile is None:
            profile = await self._fetch_profile()

        portfolio_connection = await self._ensure_portfolio_connection(user_id)
        account = await self._upsert_portfolio_account(
            connection_id=portfolio_connection["id"],
            user_id=user_id,
            profile=profile,
        )
        positions = await self._sync_positions(
            account_id=account["id"],
            holdings_data=await asyncio.to_thread(r.build_holdings),
        )
        orders_count = await self._sync_orders(user_id)

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
            "Robinhood sync completed for user %s: %s positions, %s orders",
            user_id,
            len(positions),
            orders_count,
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
                "orders_count": 0,
                "setup_required": True,
                "message": str(error),
            }

        if not connection:
            return {
                "is_connected": False,
                "last_synced_at": None,
                "profile": None,
                "positions_count": 0,
                "orders_count": 0,
            }

        account = await self._get_portfolio_account(user_id)
        positions_count = 0
        if account:
            result = (
                self.supabase.table("snaptrade_positions")
                .select("id", count="exact")
                .eq("account_id", account["id"])
                .execute()
            )
            positions_count = result.count or 0

        orders = (
            self.supabase.table("robinhood_stock_orders")
            .select("order_id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )

        return {
            "is_connected": connection.get("is_connected", False),
            "last_synced_at": connection.get("last_synced_at"),
            "profile": connection.get("profile"),
            "positions_count": positions_count,
            "orders_count": orders.count or 0,
        }

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

    async def get_orders(
        self,
        user_id: str,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Return synced Robinhood stock orders for the current user."""

        connection = await self._get_robinhood_connection(user_id)
        if not connection:
            return {"orders": [], "total": 0, "limit": limit, "offset": offset}

        query = (
            self.supabase.table("robinhood_stock_orders")
            .select(
                "id, order_id, ticker, side, order_type, quantity, average_price, "
                "total_amount, state, created_time, executed_time, fees, raw_order",
                count="exact",
            )
            .eq("user_id", user_id)
            .order("created_time", desc=True)
            .range(offset, offset + limit - 1)
        )
        result = query.execute()
        return {
            "orders": result.data or [],
            "total": result.count or 0,
            "limit": limit,
            "offset": offset,
        }

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
    ) -> List[Dict[str, Any]]:
        synced_positions: List[Dict[str, Any]] = []
        synced_keys: Set[str] = set()

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

        existing = (
            self.supabase.table("snaptrade_positions")
            .select("id, symbol, position_type")
            .eq("account_id", account_id)
            .execute()
        )
        for pos in existing.data or []:
            key = f"{pos.get('symbol')}:{pos.get('position_type', 'equity')}"
            if key not in synced_keys:
                self.supabase.table("snaptrade_positions").delete().eq(
                    "id", pos["id"]
                ).execute()

        return synced_positions

    async def _sync_orders(self, user_id: str) -> int:
        orders_data = await asyncio.to_thread(r.get_all_stock_orders)
        count = 0
        for raw_order in orders_data or []:
            order_id = raw_order.get("id")
            instrument_url = raw_order.get("instrument")
            if not order_id or not instrument_url:
                continue

            ticker = await asyncio.to_thread(r.get_symbol_by_url, instrument_url)
            quantity = _safe_float(
                raw_order.get("cumulative_quantity") or raw_order.get("quantity")
            )
            average_price = _safe_float(raw_order.get("average_price"))

            order = {
                "user_id": user_id,
                "order_id": order_id,
                "ticker": ticker or "UNKNOWN",
                "side": _safe_str(raw_order.get("side")),
                "order_type": _safe_str(raw_order.get("type")),
                "quantity": quantity,
                "average_price": average_price if average_price > 0 else None,
                "total_amount": quantity * average_price,
                "state": _safe_str(raw_order.get("state")),
                "created_time": _parse_robinhood_timestamp(raw_order.get("created_at")),
                "executed_time": _parse_robinhood_timestamp(
                    raw_order.get("last_transaction_at")
                ),
                "fees": _safe_float(raw_order.get("fees")),
                "raw_order": raw_order,
            }
            self.supabase.table("robinhood_stock_orders").upsert(
                order, on_conflict="user_id,order_id"
            ).execute()
            count += 1
        return count

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
