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
from app.services.notification_service import NotificationService, get_notification_service

logger = logging.getLogger(__name__)


class SnapTradeService:
    """SnapTrade 业务服务"""

    def __init__(
        self,
        client: Optional[SnapTradeClient] = None,
        supabase: Optional[Client] = None,
        notification_service: Optional[NotificationService] = None,
    ):
        self.client = client or get_snaptrade_client()
        self.supabase = supabase or get_supabase_service()
        self.notification_service = notification_service or get_notification_service()

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
        
        # ===== 持仓变化检测 =====
        # 获取旧持仓数据用于比较（只针对 equity 类型，期权暂不通知）
        old_positions_map: Dict[str, Dict[str, Any]] = {}
        for account in accounts.data or []:
            old_positions = (
                self.supabase.table("snaptrade_positions")
                .select("symbol, units, price, position_type")
                .eq("account_id", account["id"])
                .eq("position_type", "equity")
                .execute()
            )
            for pos in old_positions.data or []:
                symbol = pos.get("symbol")
                if symbol:
                    # 累加同一股票在不同账户的持仓
                    if symbol in old_positions_map:
                        old_positions_map[symbol]["units"] += pos.get("units", 0)
                    else:
                        old_positions_map[symbol] = {
                            "units": pos.get("units", 0),
                            "price": pos.get("price", 0),
                        }

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

        # ===== 检测持仓变化并通知粉丝 =====
        # 只有当用户设置了公开且有粉丝时才发送通知
        if connection.get("is_public", False):
            await self._detect_and_notify_position_changes(
                user_id, old_positions_map, all_positions
            )

        return all_positions
    
    async def _detect_and_notify_position_changes(
        self,
        user_id: str,
        old_positions: Dict[str, Dict[str, Any]],
        new_positions: List[Dict[str, Any]],
    ) -> None:
        """
        检测持仓变化并通知粉丝
        
        Args:
            user_id: 用户ID
            old_positions: 旧持仓映射 {symbol: {units, price}}
            new_positions: 新持仓列表
        """
        try:
            # 构建新持仓映射（只处理 equity 类型）
            new_positions_map: Dict[str, Dict[str, Any]] = {}
            for pos in new_positions:
                if pos.get("position_type") != "equity":
                    continue
                symbol = pos.get("symbol")
                if symbol:
                    if symbol in new_positions_map:
                        new_positions_map[symbol]["units"] += pos.get("units", 0)
                    else:
                        new_positions_map[symbol] = {
                            "units": pos.get("units", 0),
                            "price": pos.get("price", 0),
                        }
            
            changes = []
            
            # 检测买入（新增）和加仓
            for symbol, new_data in new_positions_map.items():
                old_data = old_positions.get(symbol)
                new_units = new_data.get("units", 0)
                
                if old_data is None:
                    # 新买入
                    changes.append({
                        "type": "buy",
                        "symbol": symbol,
                        "units_change": new_units,
                        "current_units": new_units,
                        "price": new_data.get("price"),
                    })
                else:
                    old_units = old_data.get("units", 0)
                    if new_units > old_units:
                        # 加仓
                        changes.append({
                            "type": "increase",
                            "symbol": symbol,
                            "units_change": new_units - old_units,
                            "current_units": new_units,
                            "price": new_data.get("price"),
                        })
                    elif new_units < old_units:
                        # 减仓
                        changes.append({
                            "type": "decrease",
                            "symbol": symbol,
                            "units_change": old_units - new_units,
                            "current_units": new_units,
                            "price": new_data.get("price"),
                        })
            
            # 检测卖出（完全清仓）
            for symbol, old_data in old_positions.items():
                if symbol not in new_positions_map:
                    changes.append({
                        "type": "sell",
                        "symbol": symbol,
                        "units_change": old_data.get("units", 0),
                        "current_units": 0,
                        "price": old_data.get("price"),
                    })
            
            # 如果有变化，通知粉丝
            if changes:
                # 获取用户名
                user_profile = (
                    self.supabase.table("user_profiles")
                    .select("username, full_name")
                    .eq("id", user_id)
                    .single()
                    .execute()
                )
                
                username = "Someone you follow"
                if user_profile.data:
                    username = user_profile.data.get("full_name") or user_profile.data.get("username") or username
                
                logger.info(f"检测到用户 {user_id} 的 {len(changes)} 个持仓变化")
                await self.notification_service.notify_followers_of_position_changes(
                    user_id=user_id,
                    username=username,
                    changes=changes,
                )
                
        except Exception as e:
            logger.error(f"检测持仓变化失败: {e}")

    async def get_user_holdings(self, user_id: str) -> Dict[str, Any]:
        """
        获取用户的持仓数据（从数据库缓存），并计算持股比例

        Args:
            user_id: Supabase 用户 ID

        Returns:
            持仓数据（包含每个持仓的 weight_percent 字段）
        """
        connection = await self._get_connection(user_id)
        if not connection:
            return {
                "accounts": [],
                "is_connected": False,
                "is_public": False,
                "total_value": 0,
            }

        # 获取账户和持仓（包含 is_hidden 字段供用户管理）
        accounts = (
            self.supabase.table("snaptrade_accounts")
            .select("*, snaptrade_positions(*, is_hidden)")
            .eq("connection_id", connection["id"])
            .execute()
        )

        accounts_data = accounts.data or []

        # 计算总市值
        total_portfolio_value = 0.0
        for account in accounts_data:
            for pos in account.get("snaptrade_positions", []):
                price = pos.get("price") or 0
                units = pos.get("units") or 0
                position_type = pos.get("position_type", "equity")
                multiplier = 100 if position_type == "option" else 1
                value = price * units * multiplier
                total_portfolio_value += value

        # 为每个持仓计算权重百分比
        for account in accounts_data:
            for pos in account.get("snaptrade_positions", []):
                price = pos.get("price") or 0
                units = pos.get("units") or 0
                position_type = pos.get("position_type", "equity")
                multiplier = 100 if position_type == "option" else 1
                value = price * units * multiplier

                # 计算持仓权重 (0-100)
                if total_portfolio_value > 0:
                    pos["weight_percent"] = round(
                        (value / total_portfolio_value) * 100, 2
                    )
                else:
                    pos["weight_percent"] = 0.0

                # 同时添加持仓市值
                pos["market_value"] = round(value, 2)

        return {
            "is_connected": connection.get("is_connected", False),
            "is_public": connection.get("is_public", False),
            "last_synced_at": connection.get("last_synced_at"),
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

        # 获取隐私设置
        default_settings = {
            "show_total_value": True,
            "show_total_pnl": True,
            "show_pnl_percent": True,
            "show_positions_count": True,
            "show_shares": True,
            "show_position_value": True,
            "show_position_pnl": True,
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
        accounts = (
            self.supabase.table("snaptrade_accounts")
            .select("*, snaptrade_positions(*)")
            .eq("connection_id", connection["id"])
            .execute()
        )

        # 过滤掉隐藏的账户
        accounts_data = [
            acc
            for acc in (accounts.data or [])
            if acc.get("id") not in hidden_account_ids
        ]

        # 计算总市值和盈亏（仅计算可见持仓用于统计）
        total_portfolio_value = 0.0
        total_pnl = 0.0
        positions_count = 0
        hidden_positions_count = 0

        for account in accounts_data:
            for pos in account.get("snaptrade_positions", []):
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
            for pos in account.get("snaptrade_positions", []):
                is_hidden = pos.get("is_hidden", False)
                price = pos.get("price") or 0
                units = pos.get("units") or 0
                position_type = pos.get("position_type", "equity")
                multiplier = 100 if position_type == "option" else 1
                value = price * units * multiplier

                if total_portfolio_value > 0 and not is_hidden:
                    pos["weight_percent"] = round(
                        (value / total_portfolio_value) * 100, 2
                    )
                else:
                    pos["weight_percent"] = 0.0

                pos["market_value"] = round(value, 2)

                # 如果持仓被隐藏，将敏感数据设为 null（前端显示 *）
                if is_hidden:
                    pos["units"] = None
                    pos["price"] = None
                    pos["market_value"] = None
                    pos["open_pnl"] = None
                    pos["weight_percent"] = None
                    pos["average_purchase_price"] = None
                else:
                    # 应用隐私设置 - 隐藏用户不想公开的字段
                    if not privacy_settings.get("show_shares"):
                        pos["units"] = None
                    if not privacy_settings.get("show_position_value"):
                        pos["market_value"] = None
                    if not privacy_settings.get("show_position_pnl"):
                        pos["open_pnl"] = None
                    if not privacy_settings.get("show_position_weight"):
                        pos["weight_percent"] = None
                    if not privacy_settings.get("show_position_cost"):
                        pos["average_purchase_price"] = None

        # 构建响应，应用隐私设置（与 get_user_holdings 格式保持一致）
        response = {
            "user_id": user_id,
            "is_connected": True,  # 公开持仓必然已连接
            "is_public": True,  # 公开持仓必然已公开
            "last_synced_at": connection.get("last_synced_at"),
            "accounts": accounts_data,
            "privacy_settings": privacy_settings,
        }

        # 根据隐私设置决定是否返回汇总数据
        if privacy_settings.get("show_total_value"):
            response["total_value"] = round(total_portfolio_value, 2)
        else:
            response["total_value"] = None

        if privacy_settings.get("show_total_pnl"):
            response["total_pnl"] = round(total_pnl, 2)
        else:
            response["total_pnl"] = None

        if privacy_settings.get("show_pnl_percent"):
            if total_portfolio_value > total_pnl and total_portfolio_value > 0:
                response["pnl_percent"] = round(
                    (total_pnl / (total_portfolio_value - total_pnl)) * 100, 2
                )
            else:
                response["pnl_percent"] = 0
        else:
            response["pnl_percent"] = None

        if privacy_settings.get("show_positions_count"):
            response["positions_count"] = positions_count
        else:
            response["positions_count"] = None

        # 账户数量（已过滤隐藏账户后的数量）
        response["accounts_count"] = len(accounts_data)

        # 隐藏的账户数量（让前端知道有多少被隐藏）
        response["hidden_accounts_count"] = len(hidden_account_ids)

        # 添加隐藏持仓数量（让前端知道有多少被隐藏）
        response["hidden_positions_count"] = hidden_positions_count

        return response

    async def get_public_users(
        self,
        limit: int = 20,
        offset: int = 0,
        sort_by: str = "updated",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """
        获取所有公开持仓的用户列表

        Args:
            limit: 返回数量限制
            offset: 分页偏移量
            sort_by: 排序字段 - "updated" (last_synced_at) 或 "pnl_percent"
            sort_order: 排序顺序 - "asc" 或 "desc"

        Returns:
            包含用户列表和总数的字典
        """
        # 对于 pnl_percent 排序，需要获取所有数据后再排序
        # 对于 updated 排序，可以直接在数据库查询时排序
        is_pnl_sort = sort_by == "pnl_percent"

        # 获取所有公开的连接，关联用户资料和隐私设置
        query = (
            self.supabase.table("snaptrade_connections")
            .select("user_id, last_synced_at, created_at, privacy_settings")
            .eq("is_public", True)
            .eq("is_connected", True)
        )

        # 如果是按更新时间排序，直接在查询中排序并分页
        if not is_pnl_sort:
            query = query.order("last_synced_at", desc=(sort_order == "desc"))
            query = query.range(offset, offset + limit - 1)

        result = query.execute()

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

        # 默认隐私设置
        default_privacy = {
            "show_total_value": True,
            "show_total_pnl": True,
            "show_pnl_percent": True,
            "show_positions_count": True,
            "show_shares": True,
            "show_position_value": True,
            "show_position_pnl": True,
            "show_position_weight": True,
            "show_position_cost": True,
            "hidden_accounts": [],
        }

        # 获取用户详细信息和持仓汇总
        users = []
        for conn in result.data:
            user_id = conn["user_id"]

            # 获取隐私设置
            privacy = {**default_privacy, **(conn.get("privacy_settings") or {})}

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
                # 获取隐藏的账户 ID 列表
                hidden_account_ids = set(privacy.get("hidden_accounts", []))

                # 获取账户和持仓（包含 is_hidden 字段）
                accounts = (
                    self.supabase.table("snaptrade_accounts")
                    .select("id, snaptrade_positions(*, is_hidden)")
                    .eq("connection_id", connection.data["id"])
                    .execute()
                )

                for account in accounts.data or []:
                    # 跳过隐藏的账户
                    if account.get("id") in hidden_account_ids:
                        continue

                    for pos in account.get("snaptrade_positions", []):
                        # 跳过隐藏的持仓
                        if pos.get("is_hidden", False):
                            continue

                        price = pos.get("price") or 0
                        units = pos.get("units") or 0
                        position_type = pos.get("position_type", "equity")
                        multiplier = 100 if position_type == "option" else 1
                        value = price * units * multiplier
                        pnl = pos.get("open_pnl") or 0

                        total_value += value
                        total_pnl += pnl
                        positions_count += 1

                        # 收集持仓用于排序
                        top_positions.append(
                            {
                                "symbol": pos.get("symbol"),
                                "value": value,
                                "pnl": pnl,
                            }
                        )

            # 按价值排序top持仓
            top_positions.sort(key=lambda x: x["value"], reverse=True)

            # 根据隐私设置决定返回的字段
            user_data = {
                "user_id": user_id,
                "username": profile.data.get("username") if profile.data else None,
                "full_name": profile.data.get("full_name") if profile.data else None,
                "avatar_url": profile.data.get("avatar_url") if profile.data else None,
                "last_synced_at": conn.get("last_synced_at"),
                "total_value": total_value if privacy.get("show_total_value") else None,
                "total_pnl": total_pnl if privacy.get("show_total_pnl") else None,
                "pnl_percent": (
                    (
                        (total_pnl / (total_value - total_pnl) * 100)
                        if total_value > total_pnl and total_value > 0
                        else 0
                    )
                    if privacy.get("show_pnl_percent")
                    else None
                ),
                "positions_count": (
                    positions_count if privacy.get("show_positions_count") else None
                ),
                "top_positions": top_positions[:5],
            }

            users.append(user_data)

        # 如果是按 pnl_percent 排序，需要在内存中排序后分页
        if is_pnl_sort:
            # 对于 pnl_percent 为 None 的用户，使用 -infinity 或 +infinity 来排序
            def get_sort_key(u):
                pnl = u.get("pnl_percent")
                if pnl is None:
                    return float("-inf") if sort_order == "desc" else float("inf")
                return pnl

            users.sort(key=get_sort_key, reverse=(sort_order == "desc"))
            # 分页
            users = users[offset : offset + limit]

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
        connection = await self._get_connection(user_id)
        if not connection:
            raise Exception("用户未连接 SnapTrade")

        # 验证持仓属于该用户
        position = (
            self.supabase.table("snaptrade_positions")
            .select("id, account_id")
            .eq("id", position_id)
            .single()
            .execute()
        )

        if not position.data:
            raise Exception("持仓不存在")

        # 验证账户属于该用户的连接
        account = (
            self.supabase.table("snaptrade_accounts")
            .select("connection_id")
            .eq("id", position.data["account_id"])
            .single()
            .execute()
        )

        if not account.data or account.data["connection_id"] != connection["id"]:
            raise Exception("无权修改此持仓")

        # 更新持仓隐藏状态
        result = (
            self.supabase.table("snaptrade_positions")
            .update({"is_hidden": is_hidden})
            .eq("id", position_id)
            .execute()
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
        connection = await self._get_connection(user_id)
        if not connection:
            raise Exception("用户未连接 SnapTrade")

        # 获取用户所有账户 ID
        accounts = (
            self.supabase.table("snaptrade_accounts")
            .select("id")
            .eq("connection_id", connection["id"])
            .execute()
        )

        if not accounts.data:
            return 0

        account_ids = [a["id"] for a in accounts.data]

        # 批量更新属于用户的持仓
        result = (
            self.supabase.table("snaptrade_positions")
            .update({"is_hidden": is_hidden})
            .in_("id", position_ids)
            .in_("account_id", account_ids)
            .execute()
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
            raise Exception("用户未连接 SnapTrade")

        # 默认设置
        default_settings = {
            "show_total_value": True,
            "show_total_pnl": True,
            "show_pnl_percent": True,
            "show_positions_count": True,
            "show_shares": True,
            "show_position_value": True,
            "show_position_pnl": True,
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
            raise Exception("用户未连接 SnapTrade")

        # 获取当前设置
        current_settings = await self.get_privacy_settings(user_id)

        # 合并新设置
        updated_settings = {**current_settings, **settings}

        # 更新数据库
        result = (
            self.supabase.table("snaptrade_connections")
            .update({"privacy_settings": updated_settings})
            .eq("id", connection["id"])
            .execute()
        )

        if not result.data:
            raise Exception("更新隐私设置失败")

        return updated_settings

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
