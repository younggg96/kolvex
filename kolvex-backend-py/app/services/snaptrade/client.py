"""
SnapTrade API Client
Using official snaptrade-python-sdk
"""

import logging
from typing import Optional, Dict, Any, List
from snaptrade_client import SnapTrade
from app.core.config import settings

logger = logging.getLogger(__name__)


class SnapTradeClient:
    """SnapTrade API Client using official SDK"""

    def __init__(self):
        self.client_id = settings.SNAPTRADE_CLIENT_ID
        self.consumer_key = settings.SNAPTRADE_CONSUMER_KEY

        if not self.client_id or not self.consumer_key:
            logger.warning("SnapTrade API credentials not configured")
            self._client = None
        else:
            self._client = SnapTrade(
                consumer_key=self.consumer_key,
                client_id=self.client_id,
            )
            logger.info("SnapTrade client initialized successfully")

    def _ensure_client(self):
        """Ensure client is initialized"""
        if not self._client:
            raise ValueError("SnapTrade client not initialized - check API credentials")

    async def check_api_status(self) -> Dict[str, Any]:
        """Check API status"""
        self._ensure_client()
        response = self._client.api_status.check()
        return response.body

    async def register_user(self, user_id: str) -> Dict[str, Any]:
        """Register a new user on SnapTrade"""
        self._ensure_client()
        response = self._client.authentication.register_snap_trade_user(user_id=user_id)
        logger.info(f"User registered: {user_id}")
        return response.body

    async def delete_user(self, user_id: str) -> bool:
        """Delete a SnapTrade user"""
        self._ensure_client()
        try:
            self._client.authentication.delete_snap_trade_user(user_id=user_id)
            logger.info(f"User deleted: {user_id}")
            return True
        except Exception as e:
            logger.error(f"Delete user failed: {e}")
            return False

    async def get_connection_portal_url(
        self,
        user_id: str,
        user_secret: str,
        redirect_uri: Optional[str] = None,
        connection_type: str = "read",
    ) -> Dict[str, Any]:
        """Generate connection portal URL for connecting brokerage accounts"""
        self._ensure_client()
        kwargs = {"user_id": user_id, "user_secret": user_secret}
        if redirect_uri:
            kwargs["custom_redirect"] = redirect_uri
        if connection_type == "trade":
            kwargs["connection_type"] = "trade"

        response = self._client.authentication.login_snap_trade_user(**kwargs)
        logger.info(f"Connection portal URL generated for user: {user_id}")
        return response.body

    async def list_accounts(
        self, user_id: str, user_secret: str
    ) -> List[Dict[str, Any]]:
        """List user's connected accounts"""
        self._ensure_client()
        response = self._client.account_information.list_user_accounts(
            user_id=user_id, user_secret=user_secret
        )
        return response.body

    async def get_account_detail(
        self, user_id: str, user_secret: str, account_id: str
    ) -> Dict[str, Any]:
        """Get account details"""
        self._ensure_client()
        response = self._client.account_information.get_user_account_details(
            account_id=account_id, user_id=user_id, user_secret=user_secret
        )
        return response.body

    async def get_account_positions(
        self, user_id: str, user_secret: str, account_id: str
    ) -> List[Dict[str, Any]]:
        """Get account positions (stocks/ETFs/crypto/mutual funds)"""
        self._ensure_client()
        response = self._client.account_information.get_user_account_positions(
            account_id=account_id, user_id=user_id, user_secret=user_secret
        )
        return response.body

    async def get_option_positions(
        self, user_id: str, user_secret: str, account_id: str
    ) -> List[Dict[str, Any]]:
        """Get account option positions"""
        self._ensure_client()
        response = self._client.options.list_option_holdings(
            account_id=account_id, user_id=user_id, user_secret=user_secret
        )
        return response.body

    async def get_all_holdings(self, user_id: str, user_secret: str) -> Dict[str, Any]:
        """Get all holdings across all accounts"""
        self._ensure_client()
        response = self._client.account_information.get_all_user_holdings(
            user_id=user_id, user_secret=user_secret
        )
        return response.body

    async def get_account_balances(
        self, user_id: str, user_secret: str, account_id: str
    ) -> Dict[str, Any]:
        """Get account balances"""
        self._ensure_client()
        response = self._client.account_information.get_user_account_balance(
            account_id=account_id, user_id=user_id, user_secret=user_secret
        )
        return response.body

    async def get_user_connections(
        self, user_id: str, user_secret: str
    ) -> List[Dict[str, Any]]:
        """Get user's broker connections (authorizations)"""
        self._ensure_client()
        response = self._client.connections.list_brokerage_authorizations(
            user_id=user_id, user_secret=user_secret
        )
        return response.body

    async def remove_connection(
        self, user_id: str, user_secret: str, authorization_id: str
    ) -> bool:
        """Remove a broker connection"""
        self._ensure_client()
        try:
            self._client.connections.remove_brokerage_authorization(
                authorization_id=authorization_id,
                user_id=user_id,
                user_secret=user_secret,
            )
            logger.info(f"Connection removed: {authorization_id}")
            return True
        except Exception as e:
            logger.error(f"Remove connection failed: {e}")
            return False


# Client singleton
_snaptrade_client: Optional[SnapTradeClient] = None


def get_snaptrade_client() -> SnapTradeClient:
    """Get SnapTrade client singleton"""
    global _snaptrade_client
    if _snaptrade_client is None:
        _snaptrade_client = SnapTradeClient()
    return _snaptrade_client
