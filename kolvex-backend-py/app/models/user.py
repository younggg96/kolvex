"""
用户相关数据库模型
"""
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base
import enum

Base = declarative_base()


class MembershipEnum(str, enum.Enum):
    """会员类型枚举"""
    FREE = "FREE"
    PRO = "PRO"
    ENTERPRISE = "ENTERPRISE"


class ThemeEnum(str, enum.Enum):
    """主题枚举"""
    LIGHT = "LIGHT"
    DARK = "DARK"
    SYSTEM = "SYSTEM"


class NotificationMethodEnum(str, enum.Enum):
    """通知方式枚举"""
    EMAIL = "EMAIL"
    MESSAGE = "MESSAGE"


class UserProfile(Base):
    """用户资料表模型
    
    注意：此表在 Supabase 中已存在，这里的模型主要用于类型提示和数据验证
    实际的数据库操作通过 Supabase 客户端进行
    """
    __tablename__ = "user_profiles"
    
    # 主键（与 Supabase Auth User ID 一致）
    id = Column(UUID(as_uuid=True), primary_key=True)
    
    # 基本信息
    email = Column(String, nullable=False, unique=True)
    username = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    phone_e164 = Column(String, nullable=True)
    
    # 会员和设置
    membership = Column(
        SQLEnum(MembershipEnum, name="membership_enum"),
        default=MembershipEnum.FREE,
        nullable=False
    )
    theme = Column(
        SQLEnum(ThemeEnum, name="theme_enum"),
        default=ThemeEnum.SYSTEM,
        nullable=True
    )
    
    # 通知设置
    is_subscribe_newsletter = Column(Boolean, default=False)
    notification_method = Column(
        SQLEnum(NotificationMethodEnum, name="notification_method_enum"),
        default=NotificationMethodEnum.EMAIL,
        nullable=True
    )
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    def __repr__(self):
        return f"<UserProfile(id={self.id}, email={self.email}, username={self.username})>"

