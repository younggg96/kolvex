"""
SnapTrade 服务层
处理业务逻辑和数据库操作
"""

import logging
import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime
from supabase import Client

from app.core.supabase import get_supabase_service
from .client import SnapTradeClient, get_snaptrade_client

logger = logging.getLogger(__name__)


class SnapTradeService:
    """SnapTrade 业务服务"""

    def __init__(
        self,
        client: Optional[SnapTradeClient] = None,
        supabase: Optional[Client] = None,
    ):
        self.client = client or get_snaptrade_client()
        self.supabase = supabase or get_supabase_service()

    async def get_or_create_snaptrade_user(self, user_id: str) -> Dict[str, Any]:
        """
        获取或创建用户的 SnapTrade 连接

        Args:
            user_id: Supabase 用户 ID

        Returns:
            SnapTrade 连接信息
        """
        # 先检查数据库中是否已有连接
        result = (
            self.supabase.table("snaptrade_connections")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )

        if result.data and len(result.data) > 0:
            return result.data[0]

        # 创建新的 SnapTrade 用户
        # 使用 Supabase user_id 作为 SnapTrade user_id 的基础
        snaptrade_user_id = f"kolvex_{user_id[:8]}_{uuid.uuid4().hex[:8]}"

        try:
            register_result = await self.client.register_user(snaptrade_user_id)

            # 保存到数据库
            connection_data = {
                "user_id": user_id,
                "snaptrade_user_id": snaptrade_user_id,
                "snaptrade_user_secret": register_result.get("userSecret"),
                "is_connected": False,
                "is_public": False,
            }

            insert_result = (
                self.supabase.table("snaptrade_connections")
                .insert(connection_data)
                .execute()
            )

            if insert_result.data:
                return insert_result.data[0]

            raise Exception("无法保存 SnapTrade 连接信息")

        except Exception as e:
            logger.error(f"创建 SnapTrade 用户失败: {e}")
            raise

    async def get_connection_portal_url(
        self, user_id: str, redirect_uri: Optional[str] = None
    ) -> str:
        """
        获取连接门户 URL

        Args:
            user_id: Supabase 用户 ID
            redirect_uri: 重定向 URI

        Returns:
            连接门户 URL
        """
        connection = await self.get_or_create_snaptrade_user(user_id)

        result = await self.client.get_connection_portal_url(
            user_id=connection["snaptrade_user_id"],
            user_secret=connection["snaptrade_user_secret"],
            redirect_uri=redirect_uri,
        )

        return result.get("redirectURI", "")

    async def sync_accounts(self, user_id: str) -> List[Dict[str, Any]]:
        """
        同步用户的券商账户

        Args:
            user_id: Supabase 用户 ID

        Returns:
            账户列表
        """
        connection = await self._get_connection(user_id)
        if not connection:
            raise Exception("用户未连接 SnapTrade")

        # 获取 SnapTrade 账户
        accounts = await self.client.list_accounts(
            user_id=connection["snaptrade_user_id"],
            user_secret=connection["snaptrade_user_secret"],
        )

        # 更新或插入账户数据
        synced_accounts = []
        for account in accounts:
            account_data = {
                "connection_id": connection["id"],
                "account_id": account.get("id"),
                "brokerage_name": (
                    account.get("brokerage", {}).get("name")
                    if isinstance(account.get("brokerage"), dict)
                    else account.get("brokerage")
                ),
                "account_name": account.get("name"),
                "account_number": account.get("number"),
                "account_type": account.get("type"),
            }

            # 尝试更新，如果不存在则插入
            existing = (
                self.supabase.table("snaptrade_accounts")
                .select("*")
                .eq("connection_id", connection["id"])
                .eq("account_id", account.get("id"))
                .execute()
            )

            if existing.data and len(existing.data) > 0:
                result = (
                    self.supabase.table("snaptrade_accounts")
                    .update(account_data)
                    .eq("id", existing.data[0]["id"])
                    .execute()
                )
            else:
                result = (
                    self.supabase.table("snaptrade_accounts")
                    .insert(account_data)
                    .execute()
                )

            if result.data:
                synced_accounts.append(result.data[0])

        # 更新连接状态
        if accounts:
            self.supabase.table("snaptrade_connections").update(
                {"is_connected": True, "last_synced_at": datetime.utcnow().isoformat()}
            ).eq("id", connection["id"]).execute()

        return synced_accounts

    async def sync_positions(self, user_id: str) -> List[Dict[str, Any]]:
        """
        同步用户的持仓数据（包括股票和期权）

        Args:
            user_id: Supabase 用户 ID

        Returns:
            持仓列表
        """
        connection = await self._get_connection(user_id)
        if not connection:
            raise Exception("用户未连接 SnapTrade")

        # 获取所有账户
        accounts = (
            self.supabase.table("snaptrade_accounts")
            .select("*")
            .eq("connection_id", connection["id"])
            .execute()
        )

        all_positions = []

        for account in accounts.data or []:
            try:
                # 删除该账户旧的持仓数据
                self.supabase.table("snaptrade_positions").delete().eq(
                    "account_id", account["id"]
                ).execute()

                # 同步股票/ETF 持仓
                equity_positions = await self.client.get_account_positions(
                    user_id=connection["snaptrade_user_id"],
                    user_secret=connection["snaptrade_user_secret"],
                    account_id=account["account_id"],
                )

                for position in equity_positions:
                    symbol_info = position.get("symbol", {})
                    position_data = {
                        "account_id": account["id"],
                        "position_type": "equity",
                        "symbol": (
                            symbol_info.get("symbol", {}).get("symbol")
                            if isinstance(symbol_info.get("symbol"), dict)
                            else symbol_info.get("symbol", "Unknown")
                        ),
                        "symbol_id": symbol_info.get("id"),
                        "security_name": symbol_info.get("description")
                        or symbol_info.get("symbol", {}).get("description"),
                        "units": position.get("units", 0),
                        "price": position.get("price", 0),
                        "open_pnl": position.get("open_pnl", 0),
                        "fractional_units": position.get("fractional_units"),
                        "average_purchase_price": position.get(
                            "average_purchase_price"
                        ),
                        "currency": (
                            symbol_info.get("currency", {}).get("code")
                            if isinstance(symbol_info.get("currency"), dict)
                            else symbol_info.get("currency")
                        ),
                    }

                    result = (
                        self.supabase.table("snaptrade_positions")
                        .insert(position_data)
                        .execute()
                    )
                    if result.data:
                        all_positions.append(result.data[0])

                # 同步期权持仓
                try:
                    option_positions = await self.client.get_option_positions(
                        user_id=connection["snaptrade_user_id"],
                        user_secret=connection["snaptrade_user_secret"],
                        account_id=account["account_id"],
                    )

                    for option in option_positions:
                        symbol_info = option.get("symbol", {})
                        option_symbol = symbol_info.get("option_symbol", {})
                        underlying = option_symbol.get("underlying_symbol", {})

                        # Build option display name like "ASTS $80 CALL 12/26"
                        underlying_ticker = underlying.get("symbol", "")
                        strike = option_symbol.get("strike_price", 0)
                        opt_type = option_symbol.get("option_type", "")
                        exp_date = option_symbol.get("expiration_date", "")
                        display_name = f"{underlying_ticker} ${strike} {opt_type}"
                        if exp_date:
                            display_name += f" {exp_date}"

                        option_data = {
                            "account_id": account["id"],
                            "position_type": "option",
                            "symbol": option_symbol.get("ticker", display_name),
                            "symbol_id": symbol_info.get("id"),
                            "security_name": underlying.get("description", ""),
                            "units": option.get("units", 0),
                            "price": option.get("price", 0),
                            "open_pnl": option.get("open_pnl", 0),
                            "average_purchase_price": option.get(
                                "average_purchase_price"
                            ),
                            "currency": (
                                underlying.get("currency", {}).get("code")
                                if isinstance(underlying.get("currency"), dict)
                                else underlying.get("currency")
                            ),
                            "option_type": opt_type.lower() if opt_type else None,
                            "strike_price": strike,
                            "expiration_date": exp_date if exp_date else None,
                            "underlying_symbol": underlying_ticker,
                        }

                        result = (
                            self.supabase.table("snaptrade_positions")
                            .insert(option_data)
                            .execute()
                        )
                        if result.data:
                            all_positions.append(result.data[0])

                except Exception as e:
                    logger.warning(f"同步账户 {account['account_id']} 期权失败: {e}")

            except Exception as e:
                logger.error(f"同步账户 {account['account_id']} 持仓失败: {e}")
                continue

        # 更新同步时间
        self.supabase.table("snaptrade_connections").update(
            {"last_synced_at": datetime.utcnow().isoformat()}
        ).eq("id", connection["id"]).execute()

        return all_positions

    async def get_user_holdings(self, user_id: str) -> Dict[str, Any]:
        """
        获取用户的持仓数据（从数据库缓存）

        Args:
            user_id: Supabase 用户 ID

        Returns:
            持仓数据
        """
        connection = await self._get_connection(user_id)
        if not connection:
            return {"accounts": [], "is_connected": False, "is_public": False}

        # 获取账户和持仓
        accounts = (
            self.supabase.table("snaptrade_accounts")
            .select("*, snaptrade_positions(*)")
            .eq("connection_id", connection["id"])
            .execute()
        )

        return {
            "is_connected": connection.get("is_connected", False),
            "is_public": connection.get("is_public", False),
            "last_synced_at": connection.get("last_synced_at"),
            "accounts": accounts.data or [],
        }

    async def get_public_holdings(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        获取用户的公开持仓数据

        Args:
            user_id: 要查看的用户 ID

        Returns:
            公开持仓数据，如果未公开则返回 None
        """
        # 检查是否公开
        result = (
            self.supabase.table("snaptrade_connections")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_public", True)
            .execute()
        )

        if not result.data:
            return None

        connection = result.data[0]

        # 获取账户和持仓
        accounts = (
            self.supabase.table("snaptrade_accounts")
            .select(
                "id, brokerage_name, account_name, account_type, snaptrade_positions(symbol, security_name, units, price, open_pnl, currency)"
            )
            .eq("connection_id", connection["id"])
            .execute()
        )

        return {
            "user_id": user_id,
            "last_synced_at": connection.get("last_synced_at"),
            "accounts": accounts.data or [],
        }

    async def get_public_users(
        self, limit: int = 20, offset: int = 0
    ) -> Dict[str, Any]:
        """
        获取所有公开持仓的用户列表

        Args:
            limit: 返回数量限制
            offset: 分页偏移量

        Returns:
            包含用户列表和总数的字典
        """
        # 获取所有公开的连接，关联用户资料
        result = (
            self.supabase.table("snaptrade_connections")
            .select("user_id, last_synced_at, created_at")
            .eq("is_public", True)
            .eq("is_connected", True)
            .order("last_synced_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )

        # 获取总数
        count_result = (
            self.supabase.table("snaptrade_connections")
            .select("id", count="exact")
            .eq("is_public", True)
            .eq("is_connected", True)
            .execute()
        )

        if not result.data:
            return {"users": [], "total": 0}

        # 获取用户详细信息和持仓汇总
        users = []
        for conn in result.data:
            user_id = conn["user_id"]

            # 获取用户资料
            profile = (
                self.supabase.table("user_profiles")
                .select("username, full_name, avatar_url")
                .eq("id", user_id)
                .single()
                .execute()
            )

            # 获取持仓汇总
            connection = (
                self.supabase.table("snaptrade_connections")
                .select("id")
                .eq("user_id", user_id)
                .single()
                .execute()
            )

            total_value = 0
            total_pnl = 0
            positions_count = 0
            top_positions = []

            if connection.data:
                # 获取账户和持仓
                accounts = (
                    self.supabase.table("snaptrade_accounts")
                    .select("id, snaptrade_positions(*)")
                    .eq("connection_id", connection.data["id"])
                    .execute()
                )

                for account in accounts.data or []:
                    for pos in account.get("snaptrade_positions", []):
                        price = pos.get("price") or 0
                        units = pos.get("units") or 0
                        position_type = pos.get("position_type", "equity")
                        multiplier = 100 if position_type == "option" else 1
                        value = price * units * multiplier
                        pnl = pos.get("open_pnl") or 0

                        total_value += value
                        total_pnl += pnl
                        positions_count += 1

                        # 收集前5个持仓
                        if len(top_positions) < 5:
                            top_positions.append({
                                "symbol": pos.get("symbol"),
                                "value": value,
                                "pnl": pnl,
                            })

            # 按价值排序top持仓
            top_positions.sort(key=lambda x: x["value"], reverse=True)

            users.append({
                "user_id": user_id,
                "username": profile.data.get("username") if profile.data else None,
                "full_name": profile.data.get("full_name") if profile.data else None,
                "avatar_url": profile.data.get("avatar_url") if profile.data else None,
                "last_synced_at": conn.get("last_synced_at"),
                "total_value": total_value,
                "total_pnl": total_pnl,
                "pnl_percent": (total_pnl / (total_value - total_pnl) * 100) if total_value > total_pnl and total_value > 0 else 0,
                "positions_count": positions_count,
                "top_positions": top_positions[:5],
            })

        return {
            "users": users,
            "total": count_result.count or 0,
        }

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
            raise Exception("用户未连接 SnapTrade")

        result = (
            self.supabase.table("snaptrade_connections")
            .update({"is_public": is_public})
            .eq("id", connection["id"])
            .execute()
        )

        return bool(result.data)

    async def disconnect(self, user_id: str) -> bool:
        """
        断开 SnapTrade 连接

        Args:
            user_id: Supabase 用户 ID

        Returns:
            是否成功
        """
        connection = await self._get_connection(user_id)
        if not connection:
            return True

        try:
            # 删除 SnapTrade 用户
            await self.client.delete_user(user_id=connection["snaptrade_user_id"])
        except Exception as e:
            logger.warning(f"删除 SnapTrade 用户失败: {e}")

        # 删除数据库记录（级联删除账户和持仓）
        self.supabase.table("snaptrade_connections").delete().eq(
            "id", connection["id"]
        ).execute()

        return True

    async def get_connection_status(self, user_id: str) -> Dict[str, Any]:
        """
        获取连接状态

        Args:
            user_id: Supabase 用户 ID

        Returns:
            连接状态信息
        """
        connection = await self._get_connection(user_id)

        if not connection:
            return {
                "is_registered": False,
                "is_connected": False,
                "is_public": False,
                "accounts_count": 0,
            }

        # 统计账户数量
        accounts = (
            self.supabase.table("snaptrade_accounts")
            .select("id", count="exact")
            .eq("connection_id", connection["id"])
            .execute()
        )

        return {
            "is_registered": True,
            "is_connected": connection.get("is_connected", False),
            "is_public": connection.get("is_public", False),
            "last_synced_at": connection.get("last_synced_at"),
            "accounts_count": accounts.count or 0,
        }

    async def _get_connection(self, user_id: str) -> Optional[Dict[str, Any]]:
        """获取用户的 SnapTrade 连接"""
        result = (
            self.supabase.table("snaptrade_connections")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        logger.info(f"SnapTrade connection result: {result.data}")

        if result.data and len(result.data) > 0:
            return result.data[0]
        return None


def get_snaptrade_service() -> SnapTradeService:
    """获取 SnapTrade 服务实例（用于 FastAPI 依赖注入）"""
    return SnapTradeService()
