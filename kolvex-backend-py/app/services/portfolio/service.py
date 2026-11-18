"""
Portfolio 服务层
处理业务逻辑和数据库操作
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

from app.core.supabase import get_supabase_service
from supabase import Client

logger = logging.getLogger(__name__)


class PortfolioService:
    """Broker-neutral portfolio cache and sharing service."""

    def __init__(self, supabase: Optional[Client] = None):
        self.supabase = supabase or get_supabase_service()

    async def get_user_holdings(self, user_id: str) -> Dict[str, Any]:
        """
        获取用户的持仓数据（从数据库缓存），并计算持股比例

        Args:
            user_id: Supabase 用户 ID

        Returns:
            持仓数据（包含每个持仓的 weight_percent 字段）
        """
        connections = await self._get_connections(user_id)
        if not connections:
            return {
                "accounts": [],
                "is_connected": False,
                "is_public": False,
                "total_value": 0,
            }
        connection = connections[0]

        # 获取所有连接（Plaid + 手动导入）下的账户和持仓（包含 is_hidden 字段供用户管理）
        accounts = await asyncio.to_thread(
            self.supabase.table("portfolio_accounts")
            .select("*, portfolio_positions(*, is_hidden)")
            .in_("connection_id", [c["id"] for c in connections])
            .execute
        )

        accounts_data = _tag_sources(accounts.data or [], connections)

        # 计算总市值
        total_portfolio_value = 0.0
        for account in accounts_data:
            for pos in account.get("portfolio_positions", []):
                price = pos.get("price") or 0
                units = pos.get("units") or 0
                position_type = pos.get("position_type", "equity")
                multiplier = 100 if position_type == "option" else 1
                value = price * units * multiplier
                total_portfolio_value += value

        # 为每个持仓计算权重百分比
        for account in accounts_data:
            for pos in account.get("portfolio_positions", []):
                price = pos.get("price") or 0
                units = pos.get("units") or 0
                position_type = pos.get("position_type", "equity")
                multiplier = 100 if position_type == "option" else 1
                value = price * units * multiplier

                # 计算持仓权重 (0-100)
                if total_portfolio_value > 0:
                    pos["weight_percent"] = round((value / total_portfolio_value) * 100, 2)
                else:
                    pos["weight_percent"] = 0.0

                # 同时添加持仓市值
                pos["market_value"] = round(value, 2)

        return {
            "is_connected": any(c.get("is_connected") for c in connections),
            "is_public": connection.get("is_public", False),
            "last_synced_at": _latest_sync(connections),
            "accounts": accounts_data,
            "total_value": round(total_portfolio_value, 2),
        }

    async def get_public_holdings(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        获取用户的公开持仓数据（包含持股比例，排除隐藏持仓）

        Args:
            user_id: 要查看的用户 ID

        Returns:
            公开持仓数据，如果未公开则返回 None
        """
        # 检查是否公开
        result = await asyncio.to_thread(
            self.supabase.table("portfolio_connections")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_public", True)
            .execute
        )

        if not result.data:
            return None

        public_connections = _order_connections(result.data)
        connection = public_connections[0]

        # 获取隐私设置
        default_settings = {
            "show_total_value": True,
            "show_total_pnl": True,
            "show_pnl_percent": True,
            "show_positions_count": True,
            "show_shares": True,
            "show_position_value": True,
            "show_position_pnl": False,
            "show_position_pnl_per_share": False,
            "show_position_weight": True,
            "show_position_cost": True,
            "hidden_accounts": [],  # 隐藏的账户 ID 列表
        }
        privacy_settings = {
            **default_settings,
            **(connection.get("privacy_settings") or {}),
        }

        # 获取隐藏的账户 ID 列表
        hidden_account_ids = set(privacy_settings.get("hidden_accounts", []))

        # 获取账户和持仓（获取所有字段，然后过滤隐藏持仓）
        accounts = await asyncio.to_thread(
            self.supabase.table("portfolio_accounts")
            .select("*, portfolio_positions(*)")
            .in_("connection_id", [c["id"] for c in public_connections])
            .execute
        )

        # 过滤掉隐藏的账户
        accounts_data = [
            acc for acc in (accounts.data or []) if acc.get("id") not in hidden_account_ids
        ]

        # 计算总市值和盈亏（仅计算可见持仓用于统计）
        total_portfolio_value = 0.0
        total_pnl = 0.0
        positions_count = 0
        hidden_positions_count = 0

        for account in accounts_data:
            for pos in account.get("portfolio_positions", []):
                is_hidden = pos.get("is_hidden", False)
                if is_hidden:
                    hidden_positions_count += 1
                    continue  # 隐藏持仓不计入总值统计

                price = pos.get("price") or 0
                units = pos.get("units") or 0
                position_type = pos.get("position_type", "equity")
                multiplier = 100 if position_type == "option" else 1
                value = price * units * multiplier
                total_portfolio_value += value
                total_pnl += pos.get("open_pnl") or 0
                positions_count += 1

        # 为每个持仓计算权重百分比，并应用隐私设置
        for account in accounts_data:
            for pos in account.get("portfolio_positions", []):
                is_hidden = pos.get("is_hidden", False)
                price = pos.get("price") or 0
                units = pos.get("units") or 0
                position_type = pos.get("position_type", "equity")
                multiplier = 100 if position_type == "option" else 1
                value = price * units * multiplier

                if total_portfolio_value > 0 and not is_hidden:
                    pos["weight_percent"] = round((value / total_portfolio_value) * 100, 2)
                else:
                    pos["weight_percent"] = 0.0

                pos["market_value"] = round(value, 2)

                # 如果持仓被隐藏，将敏感数据设为 "***"
                if is_hidden:
                    pos["units"] = "***"
                    pos["market_value"] = "***"
                    pos["open_pnl"] = "***"
                    pos["weight_percent"] = "***"
                    pos["average_purchase_price"] = "***"
                else:
                    # 应用隐私设置 - 隐藏用户不想公开的字段
                    if not privacy_settings.get("show_shares"):
                        pos["units"] = "***"
                    if not privacy_settings.get("show_position_value"):
                        pos["market_value"] = "***"
                    if not privacy_settings.get("show_position_pnl"):
                        pos["open_pnl"] = "***"
                    if not privacy_settings.get("show_position_weight"):
                        pos["weight_percent"] = "***"
                    if not privacy_settings.get("show_position_cost"):
                        pos["average_purchase_price"] = "***"

        # 构建响应，应用隐私设置（与 get_user_holdings 格式保持一致）
        response = {
            "user_id": user_id,
            "is_connected": True,  # 公开持仓必然已连接
            "is_public": True,  # 公开持仓必然已公开
            "last_synced_at": _latest_sync(public_connections),
            "accounts": _tag_sources(accounts_data, public_connections),
            "privacy_settings": privacy_settings,
        }

        # 根据隐私设置决定是否返回汇总数据，隐藏时返回 "***"
        if privacy_settings.get("show_total_value"):
            response["total_value"] = round(total_portfolio_value, 2)
        else:
            response["total_value"] = "***"

        if privacy_settings.get("show_total_pnl"):
            response["total_pnl"] = round(total_pnl, 2)
        else:
            response["total_pnl"] = "***"

        if privacy_settings.get("show_pnl_percent"):
            if total_portfolio_value > total_pnl and total_portfolio_value > 0:
                response["pnl_percent"] = round(
                    (total_pnl / (total_portfolio_value - total_pnl)) * 100, 2
                )
            else:
                response["pnl_percent"] = 0
        else:
            response["pnl_percent"] = "***"

        if privacy_settings.get("show_positions_count"):
            response["positions_count"] = positions_count
        else:
            response["positions_count"] = "***"

        # 账户数量（已过滤隐藏账户后的数量）
        response["accounts_count"] = len(accounts_data)

        # 隐藏的账户数量（让前端知道有多少被隐藏）
        response["hidden_accounts_count"] = len(hidden_account_ids)

        # 添加隐藏持仓数量（让前端知道有多少被隐藏）
        response["hidden_positions_count"] = hidden_positions_count

        return response

    async def toggle_public_sharing(self, user_id: str, is_public: bool) -> bool:
        """
        切换持仓公开分享状态

        Args:
            user_id: Supabase 用户 ID
            is_public: 是否公开

        Returns:
            是否成功
        """
        connection = await self._get_connection(user_id)
        if not connection:
            raise Exception("用户未连接 Portfolio")

        # Sharing is one setting per user, so keep every connection in step.
        result = await asyncio.to_thread(
            self.supabase.table("portfolio_connections")
            .update({"is_public": is_public})
            .eq("user_id", user_id)
            .execute
        )

        return bool(result.data)

    async def toggle_position_visibility(
        self, user_id: str, position_id: str, is_hidden: bool
    ) -> bool:
        """
        切换单个持仓的公开可见性

        Args:
            user_id: Supabase 用户 ID
            position_id: 持仓 ID
            is_hidden: 是否隐藏

        Returns:
            是否成功
        """
        connections = await self._get_connections(user_id)
        if not connections:
            raise Exception("用户未连接 Portfolio")

        # 验证持仓属于该用户
        position = await asyncio.to_thread(
            self.supabase.table("portfolio_positions")
            .select("id, account_id")
            .eq("id", position_id)
            .single()
            .execute
        )

        if not position.data:
            raise Exception("持仓不存在")

        # 验证账户属于该用户的连接
        account = await asyncio.to_thread(
            self.supabase.table("portfolio_accounts")
            .select("connection_id")
            .eq("id", position.data["account_id"])
            .single()
            .execute
        )

        if not account.data or account.data["connection_id"] not in {c["id"] for c in connections}:
            raise Exception("无权修改此持仓")

        # 更新持仓隐藏状态
        result = await asyncio.to_thread(
            self.supabase.table("portfolio_positions")
            .update({"is_hidden": is_hidden})
            .eq("id", position_id)
            .execute
        )

        return bool(result.data)

    async def batch_toggle_position_visibility(
        self, user_id: str, position_ids: List[str], is_hidden: bool
    ) -> int:
        """
        批量切换持仓的公开可见性

        Args:
            user_id: Supabase 用户 ID
            position_ids: 持仓 ID 列表
            is_hidden: 是否隐藏

        Returns:
            成功更新的数量
        """
        connections = await self._get_connections(user_id)
        if not connections:
            raise Exception("用户未连接 Portfolio")

        # 获取用户所有账户 ID
        accounts = await asyncio.to_thread(
            self.supabase.table("portfolio_accounts")
            .select("id")
            .in_("connection_id", [c["id"] for c in connections])
            .execute
        )

        if not accounts.data:
            return 0

        account_ids = [a["id"] for a in accounts.data]

        # 批量更新属于用户的持仓
        result = await asyncio.to_thread(
            self.supabase.table("portfolio_positions")
            .update({"is_hidden": is_hidden})
            .in_("id", position_ids)
            .in_("account_id", account_ids)
            .execute
        )

        return len(result.data) if result.data else 0

    async def get_privacy_settings(self, user_id: str) -> Dict[str, bool]:
        """
        获取用户的隐私设置

        Args:
            user_id: Supabase 用户 ID

        Returns:
            隐私设置字典
        """
        connection = await self._get_connection(user_id)
        if not connection:
            raise Exception("用户未连接 Portfolio")

        # 默认设置
        default_settings = {
            "show_total_value": True,
            "show_total_pnl": True,
            "show_pnl_percent": True,
            "show_positions_count": True,
            "show_shares": True,
            "show_position_value": True,
            "show_position_pnl": False,
            "show_position_pnl_per_share": False,
            "show_position_weight": True,
            "show_position_cost": True,
            "hidden_accounts": [],
        }

        # 合并存储的设置
        stored_settings = connection.get("privacy_settings") or {}
        return {**default_settings, **stored_settings}

    async def update_privacy_settings(
        self, user_id: str, settings: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        更新用户的隐私设置

        Args:
            user_id: Supabase 用户 ID
            settings: 要更新的隐私设置

        Returns:
            更新后的完整隐私设置
        """
        connection = await self._get_connection(user_id)
        if not connection:
            raise Exception("用户未连接 Portfolio")

        # 获取当前设置
        current_settings = await self.get_privacy_settings(user_id)

        # 合并新设置
        updated_settings = {**current_settings, **settings}

        # 更新数据库
        result = await asyncio.to_thread(
            self.supabase.table("portfolio_connections")
            .update({"privacy_settings": updated_settings})
            .eq("user_id", user_id)
            .execute
        )

        if not result.data:
            raise Exception("更新隐私设置失败")

        return updated_settings

    async def get_connection_status(self, user_id: str) -> Dict[str, Any]:
        """
        获取连接状态

        Args:
            user_id: Supabase 用户 ID

        Returns:
            连接状态信息
        """
        connections = await self._get_connections(user_id)

        if not connections:
            return {
                "is_registered": False,
                "is_connected": False,
                "is_public": False,
                "accounts_count": 0,
            }

        # 统计账户数量
        accounts = await asyncio.to_thread(
            self.supabase.table("portfolio_accounts")
            .select("id", count="exact")
            .in_("connection_id", [c["id"] for c in connections])
            .execute
        )

        return {
            "is_registered": True,
            "is_connected": any(c.get("is_connected") for c in connections),
            "is_public": connections[0].get("is_public", False),
            "last_synced_at": _latest_sync(connections),
            "accounts_count": accounts.count or 0,
        }

    async def _get_connections(self, user_id: str) -> List[Dict[str, Any]]:
        """获取用户全部 Portfolio 连接（Plaid 在前，手动导入在后）"""
        result = await asyncio.to_thread(
            self.supabase.table("portfolio_connections").select("*").eq("user_id", user_id).execute
        )
        return _order_connections(result.data or [])

    async def _get_connection(self, user_id: str) -> Optional[Dict[str, Any]]:
        """获取主连接：分享开关和隐私设置以它为准（写入时同步到全部连接）"""
        connections = await self._get_connections(user_id)
        return connections[0] if connections else None


def _order_connections(connections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(connections, key=lambda c: (c.get("provider") == "manual", str(c.get("id"))))


def _latest_sync(connections: List[Dict[str, Any]]) -> Optional[str]:
    stamps = [c["last_synced_at"] for c in connections if c.get("last_synced_at")]
    return max(stamps) if stamps else None


def _tag_sources(
    accounts: List[Dict[str, Any]], connections: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Mark each account with where it came from so the UI can label manual imports."""
    providers = {c["id"]: c.get("provider") for c in connections}
    for account in accounts:
        account["source"] = providers.get(account.get("connection_id"), "plaid")
    return accounts


def get_portfolio_service() -> PortfolioService:
    """获取 Portfolio 服务实例（用于 FastAPI 依赖注入）"""
    return PortfolioService()
