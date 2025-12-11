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
    last_synced_at: Optional[str] = None
    accounts: List[Dict[str, Any]]


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
    total_value: float = 0
    total_pnl: float = 0
    pnl_percent: float = 0
    positions_count: int = 0
    top_positions: List[TopPosition] = []


class PublicUsersResponse(BaseModel):
    """Public users list response"""
    users: List[PublicUserSummary]
    total: int


# ========== Request Schemas ==========

class TogglePublicRequest(BaseModel):
    """Toggle public sharing request"""
    is_public: bool = Field(..., description="Whether to make portfolio public")


# ========== Common Schemas ==========

class MessageResponse(BaseModel):
    """Generic message response"""
    message: str
    success: bool = True

