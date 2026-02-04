"""
Redis 缓存服务
提供统一的缓存管理接口，支持连接池、键前缀管理、装饰器缓存等功能
"""

import json
import logging
import hashlib
import functools
from typing import Any, Optional, Callable, Union
from datetime import timedelta
import asyncio

import redis.asyncio as redis
from redis.asyncio.connection import ConnectionPool

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisService:
    """
    Redis 缓存服务类

    提供以下功能：
    - 连接池管理
    - 基础缓存操作 (get/set/delete)
    - 批量操作
    - 键前缀管理
    - 缓存装饰器
    - 健康检查
    """

    _instance: Optional["RedisService"] = None
    _pool: Optional[ConnectionPool] = None
    _client: Optional[redis.Redis] = None
    _initialized: bool = False

    def __new__(cls) -> "RedisService":
        """单例模式"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def key_prefix(self) -> str:
        """获取键前缀"""
        return settings.REDIS_KEY_PREFIX

    @property
    def default_ttl(self) -> int:
        """获取默认 TTL（秒）"""
        return settings.REDIS_CACHE_TTL

    def _make_key(self, key: str) -> str:
        """生成带前缀的完整键"""
        if key.startswith(self.key_prefix):
            return key
        return f"{self.key_prefix}{key}"

    async def initialize(self) -> None:
        """初始化 Redis 连接池"""
        if self._initialized:
            logger.debug("Redis 已经初始化，跳过")
            return

        try:
            # 构建连接 URL
            if settings.REDIS_URL and settings.REDIS_URL != "redis://localhost:6379/0":
                # 使用完整的 URL 配置（优先）
                redis_url = settings.REDIS_URL
            else:
                # 使用单独的配置项构建 URL
                password_part = (
                    f":{settings.REDIS_PASSWORD}@" if settings.REDIS_PASSWORD else ""
                )
                redis_url = f"redis://{password_part}{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}"

            # 创建连接池
            self._pool = ConnectionPool.from_url(
                redis_url,
                max_connections=settings.REDIS_MAX_CONNECTIONS,
                decode_responses=True,  # 自动解码为字符串
            )

            # 创建客户端
            self._client = redis.Redis(connection_pool=self._pool)

            # 测试连接
            await self._client.ping()

            self._initialized = True
            logger.info(
                f"✅ Redis 连接成功: {settings.REDIS_HOST}:{settings.REDIS_PORT}"
            )

        except Exception as e:
            logger.warning(f"⚠️ Redis 连接失败，缓存功能将不可用: {e}")
            self._initialized = False
            self._client = None
            self._pool = None

    async def close(self) -> None:
        """关闭 Redis 连接"""
        if self._client:
            await self._client.aclose()
            self._client = None
        if self._pool:
            await self._pool.disconnect()
            self._pool = None
        self._initialized = False
        logger.info("🛑 Redis 连接已关闭")

    @property
    def is_connected(self) -> bool:
        """检查是否已连接"""
        return self._initialized and self._client is not None

    async def health_check(self) -> dict:
        """健康检查"""
        if not self.is_connected:
            return {"status": "disconnected", "message": "Redis 未连接"}

        try:
            await self._client.ping()
            info = await self._client.info("server")
            return {
                "status": "healthy",
                "redis_version": info.get("redis_version", "unknown"),
                "connected_clients": info.get("connected_clients", 0),
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # ==================== 基础操作 ====================

    async def get(self, key: str) -> Optional[str]:
        """获取缓存值"""
        if not self.is_connected:
            return None

        try:
            full_key = self._make_key(key)
            return await self._client.get(full_key)
        except Exception as e:
            logger.error(f"Redis GET 错误 [{key}]: {e}")
            return None

    async def get_json(self, key: str) -> Optional[Any]:
        """获取 JSON 格式的缓存值"""
        value = await self.get(key)
        if value is None:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            logger.warning(f"Redis JSON 解析失败 [{key}]")
            return None

    async def set(
        self,
        key: str,
        value: Union[str, int, float],
        ttl: Optional[int] = None,
    ) -> bool:
        """设置缓存值"""
        if not self.is_connected:
            return False

        try:
            full_key = self._make_key(key)
            expire = ttl if ttl is not None else self.default_ttl
            await self._client.set(full_key, value, ex=expire)
            return True
        except Exception as e:
            logger.error(f"Redis SET 错误 [{key}]: {e}")
            return False

    async def set_json(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
    ) -> bool:
        """设置 JSON 格式的缓存值"""
        try:
            json_value = json.dumps(value, ensure_ascii=False, default=str)
            return await self.set(key, json_value, ttl)
        except (TypeError, json.JSONEncodeError) as e:
            logger.error(f"Redis JSON 序列化失败 [{key}]: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """删除缓存"""
        if not self.is_connected:
            return False

        try:
            full_key = self._make_key(key)
            await self._client.delete(full_key)
            return True
        except Exception as e:
            logger.error(f"Redis DELETE 错误 [{key}]: {e}")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """按模式删除缓存"""
        if not self.is_connected:
            return 0

        try:
            full_pattern = self._make_key(pattern)
            keys = []
            async for key in self._client.scan_iter(match=full_pattern):
                keys.append(key)

            if keys:
                deleted = await self._client.delete(*keys)
                logger.info(f"Redis 批量删除 [{pattern}]: {deleted} 个键")
                return deleted
            return 0
        except Exception as e:
            logger.error(f"Redis DELETE PATTERN 错误 [{pattern}]: {e}")
            return 0

    async def exists(self, key: str) -> bool:
        """检查键是否存在"""
        if not self.is_connected:
            return False

        try:
            full_key = self._make_key(key)
            return await self._client.exists(full_key) > 0
        except Exception as e:
            logger.error(f"Redis EXISTS 错误 [{key}]: {e}")
            return False

    async def expire(self, key: str, ttl: int) -> bool:
        """设置过期时间"""
        if not self.is_connected:
            return False

        try:
            full_key = self._make_key(key)
            return await self._client.expire(full_key, ttl)
        except Exception as e:
            logger.error(f"Redis EXPIRE 错误 [{key}]: {e}")
            return False

    async def ttl(self, key: str) -> int:
        """获取剩余过期时间"""
        if not self.is_connected:
            return -2

        try:
            full_key = self._make_key(key)
            return await self._client.ttl(full_key)
        except Exception as e:
            logger.error(f"Redis TTL 错误 [{key}]: {e}")
            return -2

    # ==================== 批量操作 ====================

    async def mget(self, keys: list[str]) -> dict[str, Optional[str]]:
        """批量获取"""
        if not self.is_connected or not keys:
            return {k: None for k in keys}

        try:
            full_keys = [self._make_key(k) for k in keys]
            values = await self._client.mget(full_keys)
            return dict(zip(keys, values))
        except Exception as e:
            logger.error(f"Redis MGET 错误: {e}")
            return {k: None for k in keys}

    async def mset(self, mapping: dict[str, str], ttl: Optional[int] = None) -> bool:
        """批量设置"""
        if not self.is_connected or not mapping:
            return False

        try:
            full_mapping = {self._make_key(k): v for k, v in mapping.items()}
            await self._client.mset(full_mapping)

            # 设置过期时间
            if ttl is not None:
                for key in full_mapping.keys():
                    await self._client.expire(key, ttl)

            return True
        except Exception as e:
            logger.error(f"Redis MSET 错误: {e}")
            return False

    # ==================== 计数器操作 ====================

    async def incr(self, key: str, amount: int = 1) -> Optional[int]:
        """递增计数器"""
        if not self.is_connected:
            return None

        try:
            full_key = self._make_key(key)
            return await self._client.incrby(full_key, amount)
        except Exception as e:
            logger.error(f"Redis INCR 错误 [{key}]: {e}")
            return None

    async def decr(self, key: str, amount: int = 1) -> Optional[int]:
        """递减计数器"""
        if not self.is_connected:
            return None

        try:
            full_key = self._make_key(key)
            return await self._client.decrby(full_key, amount)
        except Exception as e:
            logger.error(f"Redis DECR 错误 [{key}]: {e}")
            return None

    # ==================== 列表操作 ====================

    async def lpush(self, key: str, *values: str) -> Optional[int]:
        """左侧推入列表"""
        if not self.is_connected:
            return None

        try:
            full_key = self._make_key(key)
            return await self._client.lpush(full_key, *values)
        except Exception as e:
            logger.error(f"Redis LPUSH 错误 [{key}]: {e}")
            return None

    async def rpush(self, key: str, *values: str) -> Optional[int]:
        """右侧推入列表"""
        if not self.is_connected:
            return None

        try:
            full_key = self._make_key(key)
            return await self._client.rpush(full_key, *values)
        except Exception as e:
            logger.error(f"Redis RPUSH 错误 [{key}]: {e}")
            return None

    async def lrange(self, key: str, start: int = 0, end: int = -1) -> list[str]:
        """获取列表范围"""
        if not self.is_connected:
            return []

        try:
            full_key = self._make_key(key)
            return await self._client.lrange(full_key, start, end)
        except Exception as e:
            logger.error(f"Redis LRANGE 错误 [{key}]: {e}")
            return []

    async def llen(self, key: str) -> int:
        """获取列表长度"""
        if not self.is_connected:
            return 0

        try:
            full_key = self._make_key(key)
            return await self._client.llen(full_key)
        except Exception as e:
            logger.error(f"Redis LLEN 错误 [{key}]: {e}")
            return 0

    # ==================== Hash 操作 ====================

    async def hget(self, name: str, key: str) -> Optional[str]:
        """获取 Hash 字段"""
        if not self.is_connected:
            return None

        try:
            full_name = self._make_key(name)
            return await self._client.hget(full_name, key)
        except Exception as e:
            logger.error(f"Redis HGET 错误 [{name}:{key}]: {e}")
            return None

    async def hset(self, name: str, key: str, value: str) -> bool:
        """设置 Hash 字段"""
        if not self.is_connected:
            return False

        try:
            full_name = self._make_key(name)
            await self._client.hset(full_name, key, value)
            return True
        except Exception as e:
            logger.error(f"Redis HSET 错误 [{name}:{key}]: {e}")
            return False

    async def hgetall(self, name: str) -> dict[str, str]:
        """获取所有 Hash 字段"""
        if not self.is_connected:
            return {}

        try:
            full_name = self._make_key(name)
            return await self._client.hgetall(full_name)
        except Exception as e:
            logger.error(f"Redis HGETALL 错误 [{name}]: {e}")
            return {}

    async def hdel(self, name: str, *keys: str) -> int:
        """删除 Hash 字段"""
        if not self.is_connected:
            return 0

        try:
            full_name = self._make_key(name)
            return await self._client.hdel(full_name, *keys)
        except Exception as e:
            logger.error(f"Redis HDEL 错误 [{name}]: {e}")
            return 0


# 全局 Redis 服务实例
redis_service = RedisService()


# ==================== 辅助函数 ====================


def get_redis() -> RedisService:
    """获取 Redis 服务实例"""
    return redis_service


async def init_redis() -> None:
    """初始化 Redis（用于应用启动）"""
    await redis_service.initialize()


async def close_redis() -> None:
    """关闭 Redis（用于应用关闭）"""
    await redis_service.close()


# ==================== 缓存装饰器 ====================


def _generate_cache_key(func: Callable, args: tuple, kwargs: dict) -> str:
    """生成缓存键"""
    # 获取函数名
    func_name = f"{func.__module__}.{func.__qualname__}"

    # 序列化参数
    key_parts = [func_name]

    # 添加位置参数
    for arg in args:
        key_parts.append(str(arg))

    # 添加关键字参数（排序确保一致性）
    for k, v in sorted(kwargs.items()):
        key_parts.append(f"{k}={v}")

    # 生成哈希
    key_str = ":".join(key_parts)
    key_hash = hashlib.md5(key_str.encode()).hexdigest()[:16]

    return f"cache:{func_name}:{key_hash}"


def cached(
    ttl: Optional[int] = None,
    key: Optional[str] = None,
    key_builder: Optional[Callable[..., str]] = None,
):
    """
    缓存装饰器

    Args:
        ttl: 缓存过期时间（秒），None 使用默认值
        key: 固定缓存键（不推荐，会导致不同参数使用相同缓存）
        key_builder: 自定义键生成函数，接收原函数的参数

    Example:
        @cached(ttl=300)
        async def get_user(user_id: str):
            ...

        @cached(key_builder=lambda ticker: f"stock:{ticker}")
        async def get_stock_data(ticker: str):
            ...
    """

    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # 如果 Redis 不可用，直接执行函数
            if not redis_service.is_connected:
                return await func(*args, **kwargs)

            # 生成缓存键
            if key:
                cache_key = key
            elif key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                cache_key = _generate_cache_key(func, args, kwargs)

            # 尝试从缓存获取
            cached_value = await redis_service.get_json(cache_key)
            if cached_value is not None:
                logger.debug(f"缓存命中: {cache_key}")
                return cached_value

            # 执行函数
            result = await func(*args, **kwargs)

            # 存入缓存
            if result is not None:
                cache_ttl = ttl if ttl is not None else redis_service.default_ttl
                await redis_service.set_json(cache_key, result, cache_ttl)
                logger.debug(f"缓存写入: {cache_key}, TTL: {cache_ttl}s")

            return result

        # 添加清除缓存的辅助方法
        async def clear_cache(*args, **kwargs):
            """清除此函数的缓存"""
            if key:
                cache_key = key
            elif key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                cache_key = _generate_cache_key(func, args, kwargs)
            await redis_service.delete(cache_key)

        wrapper.clear_cache = clear_cache
        return wrapper

    return decorator


def rate_limit(
    max_requests: int,
    window_seconds: int,
    key_builder: Optional[Callable[..., str]] = None,
):
    """
    速率限制装饰器

    Args:
        max_requests: 时间窗口内最大请求数
        window_seconds: 时间窗口（秒）
        key_builder: 自定义键生成函数

    Example:
        @rate_limit(max_requests=10, window_seconds=60)
        async def api_endpoint(user_id: str):
            ...
    """

    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # 如果 Redis 不可用，直接执行
            if not redis_service.is_connected:
                return await func(*args, **kwargs)

            # 生成速率限制键
            if key_builder:
                rate_key = f"rate_limit:{key_builder(*args, **kwargs)}"
            else:
                rate_key = f"rate_limit:{func.__module__}.{func.__qualname__}"

            # 获取当前计数
            current = await redis_service.get(rate_key)
            current_count = int(current) if current else 0

            if current_count >= max_requests:
                remaining_ttl = await redis_service.ttl(rate_key)
                raise Exception(f"请求过于频繁，请在 {remaining_ttl} 秒后重试")

            # 增加计数
            if current_count == 0:
                await redis_service.set(rate_key, "1", ttl=window_seconds)
            else:
                await redis_service.incr(rate_key)

            return await func(*args, **kwargs)

        return wrapper

    return decorator
