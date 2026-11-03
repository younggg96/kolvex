from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase_service
from app.services.paper_trading.engine import TradingError
from app.services.paper_trading.service import Conflict, PaperTradingService, StorageUnavailable

router = APIRouter(prefix="/paper-trading", tags=["Paper trading"])
Price = Annotated[float, Field(gt=0, le=10000000, allow_inf_nan=False)]


class Command(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    action: Literal["order", "cancel", "sync", "bracket"]
    symbol: str | None = Field(default=None, min_length=1, max_length=16, pattern=r"^[A-Za-z][A-Za-z0-9.\-]*$")
    side: Literal["long", "short"] | None = None
    effect: Literal["open", "close"] = "open"
    quantity: int | None = Field(default=None, ge=1, le=1000000, strict=True)
    kind: Literal["market", "limit", "stop"] | None = None
    price: Price | None = None
    stop_loss: Price | None = None
    take_profit: Price | None = None
    position_id: UUID | None = None
    order_id: UUID | None = None
    note: str = Field(default="", max_length=2000)
    source: Literal["manual", "ai_setup"] = "manual"

    @field_validator("symbol")
    @classmethod
    def upper(cls, value):
        return value.upper() if value else value

    @model_validator(mode="after")
    def valid_command(self):
        if self.action == "order":
            if not all((self.symbol, self.side, self.quantity, self.kind)):
                raise ValueError("Order requires symbol, side, quantity and kind")
            if self.kind != "market" and self.price is None:
                raise ValueError("Pending orders require a price")
            if self.kind == "market" and self.price is not None:
                raise ValueError("Market price is server supplied")
            if self.effect == "close" and not self.position_id:
                raise ValueError("Close requires position_id")
        if self.action == "cancel" and not self.order_id:
            raise ValueError("Cancel requires order_id")
        if self.action == "bracket" and not self.position_id:
            raise ValueError("Bracket requires position_id")
        return self


class Review(BaseModel):
    model_config = ConfigDict(extra="forbid")
    position_id: UUID
    note: str = Field(min_length=10, max_length=4000)

    @field_validator("note")
    @classmethod
    def trim(cls, value):
        if len(value.strip()) < 10:
            raise ValueError("Write at least 10 characters")
        return value.strip()


def get_service(db=Depends(get_supabase_service)):
    return PaperTradingService(db)


def call(operation):
    try:
        return operation()
    except TradingError as exc:
        raise HTTPException(422, detail=str(exc)) from None
    except Conflict:
        raise HTTPException(409, detail="account_conflict") from None
    except StorageUnavailable:
        raise HTTPException(503, detail="paper_storage_unavailable") from None


@router.get("/account")
def account(user_id=Depends(get_current_user_id), service=Depends(get_service)):
    return call(lambda: service.get(user_id))


@router.get("/quote/{symbol}")
def quote(symbol: str, user_id=Depends(get_current_user_id), service=Depends(get_service)):
    import re
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9.\-]{0,15}", symbol):
        raise HTTPException(422, detail="invalid_symbol")
    return call(lambda: service.quote(symbol.upper()))


@router.post("/commands")
def commands(body: Command, user_id=Depends(get_current_user_id), service=Depends(get_service)):
    return call(lambda: service.mutate(user_id, body.model_dump(mode="json")))


@router.get("/reviews")
def reviews(offset: int = Query(0, ge=0, le=10000), user_id=Depends(get_current_user_id), service=Depends(get_service)):
    return call(lambda: service.reviews(user_id, offset))


@router.post("/reviews")
def publish(body: Review, user_id=Depends(get_current_user_id), service=Depends(get_service)):
    return call(lambda: service.publish(user_id, str(body.position_id), body.note))


@router.delete("/reviews/{review_id}")
def unpublish(review_id: UUID, user_id=Depends(get_current_user_id), service=Depends(get_service)):
    return call(lambda: service.unpublish(user_id, str(review_id)))
