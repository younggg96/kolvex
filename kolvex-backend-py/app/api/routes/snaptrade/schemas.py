"""
SnapTrade API Schemas
Pydantic models for request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# ========== Connection Schemas ==========

class ConnectionPortalResponse(BaseModel):
    """Connection portal response"""
    redirect_url: str = Field(..., description="Redirect URL for broker connection")


class ConnectionStatusResponse(BaseModel):
    """Connection status response"""
    is_registered: bool = Field(..., description="Whether user is registered with SnapTrade")
    is_connected: bool = Field(..., description="Whether user has connected a broker")
    is_public: bool = Field(..., description="Whether portfolio is publicly shared")
    last_synced_at: Optional[str] = Field(None, description="Last sync timestamp")
    accounts_count: int = Field(0, description="Number of connected accounts")


# ========== Account Schemas ==========

class AccountResponse(BaseModel):
    """Account response"""
    id: str
    account_id: str
    brokerage_name: Optional[str] = None
    account_name: Optional[str] = None
    account_type: Optional[str] = None


# ========== Position Schemas ==========

class PositionResponse(BaseModel):
    """Position response"""
    symbol: str
    security_name: Optional[str] = None
    units: float
    price: Optional[float] = None
    open_pnl: Optional[float] = None
    currency: Optional[str] = None


# ========== Holdings Schemas ==========

class HoldingsResponse(BaseModel):
    """Holdings data response"""
    is_connected: bool
    is_public: bool
    last_synced_at: Optional[str] = None
    accounts: List[Dict[str, Any]]


class PublicHoldingsResponse(BaseModel):
    """Public holdings response"""
    user_id: str
    is_connected: bool = True
    is_public: bool = True
    last_synced_at: Optional[str] = None
    accounts: List[Dict[str, Any]]
    total_value: Any = None  # "***" if hidden by privacy settings
    total_pnl: Any = None  # "***" if hidden by privacy settings
    pnl_percent: Any = None  # "***" if hidden by privacy settings
    positions_count: Any = None  # "***" if hidden by privacy settings
    accounts_count: Optional[int] = None
    hidden_positions_count: Optional[int] = None
    hidden_accounts_count: Optional[int] = None
    privacy_settings: Optional[Dict[str, Any]] = None


class TopPosition(BaseModel):
    """Top position in portfolio"""
    symbol: str
    value: float
    pnl: float


class PublicUserSummary(BaseModel):
    """Public user summary for community listing"""
    user_id: str
    username: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    last_synced_at: Optional[str] = None
    total_value: Optional[float] = None  # None if hidden by privacy settings
    total_pnl: Optional[float] = None  # None if hidden by privacy settings
    pnl_percent: Optional[float] = None  # None if hidden by privacy settings
    positions_count: Optional[int] = None  # None if hidden by privacy settings
    top_positions: List[TopPosition] = []


class PublicUsersResponse(BaseModel):
    """Public users list response"""
    users: List[PublicUserSummary]
    total: int


# ========== Request Schemas ==========

class TogglePublicRequest(BaseModel):
    """Toggle public sharing request"""
    is_public: bool = Field(..., description="Whether to make portfolio public")


class TogglePositionVisibilityRequest(BaseModel):
    """Toggle position visibility request"""
    is_hidden: bool = Field(..., description="Whether to hide position from public view")


class BatchTogglePositionVisibilityRequest(BaseModel):
    """Batch toggle position visibility request"""
    position_ids: List[str] = Field(..., description="List of position IDs to update")
    is_hidden: bool = Field(..., description="Whether to hide positions from public view")


class PrivacySettings(BaseModel):
    """Privacy settings for public portfolio sharing"""
    show_total_value: Optional[bool] = Field(None, description="Show total portfolio value")
    show_total_pnl: Optional[bool] = Field(None, description="Show total unrealized P&L")
    show_pnl_percent: Optional[bool] = Field(None, description="Show P&L percentage")
    show_positions_count: Optional[bool] = Field(None, description="Show number of positions")
    show_shares: Optional[bool] = Field(None, description="Show number of shares per position")
    show_position_value: Optional[bool] = Field(None, description="Show value per position")
    show_position_pnl: Optional[bool] = Field(None, description="Show P&L per position")
    show_position_weight: Optional[bool] = Field(None, description="Show weight percentage per position")
    show_position_cost: Optional[bool] = Field(None, description="Show cost basis per position")
    hidden_accounts: Optional[List[str]] = Field(None, description="List of account IDs to hide")


class PrivacySettingsResponse(BaseModel):
    """Privacy settings response"""
    settings: Dict[str, Any]  # Can contain bool values and hidden_accounts list


# ========== Common Schemas ==========

class MessageResponse(BaseModel):
    """Generic message response"""
    message: str
    success: bool = True

