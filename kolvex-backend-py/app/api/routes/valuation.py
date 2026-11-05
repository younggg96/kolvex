"""Valuation data, deterministic calculation and signed-in AI assumption proposals."""
import asyncio
from datetime import date
import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.api.dependencies.auth import get_current_user_id
from app.core.supabase import get_supabase_service
from app.services.user_api_keys_service import UserApiKeysService, get_user_api_keys_service
from app.services.valuation.ai_assumptions import AiAssumptionsInvalid, AiKeyRejected, AiNotApplicable, AiRateLimited, ai_assumptions_service
from app.services.valuation.ai_runs import ValuationAiRuns
from app.services.valuation.sales_history import sales_history_service
from app.services.valuation.service import valuation_service
from app.services.valuation.company_inputs import company_inputs_service
from app.services.valuation.company_model import calculate_company

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/valuation", tags=["Valuation"])
Symbol = Annotated[str, Path(pattern=r"^[A-Za-z0-9][A-Za-z0-9.\-]{0,11}$")]
HEADERS = {"Cache-Control": "private, no-store"}


class Multiples(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)
    conservative: float = Field(gt=0, le=500)
    base: float = Field(gt=0, le=500)
    optimistic: float = Field(gt=0, le=500)


class Growth(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)
    conservative: float = Field(gt=-1, le=5)
    base: float = Field(gt=-1, le=5)
    optimistic: float = Field(gt=-1, le=5)


class Simulation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    snapshot_id: str = Field(pattern=r"^[a-f0-9]{64}$")
    multiples: Multiples
    growth: Growth
    target_dates: list[date] = Field(min_length=1, max_length=3)


class CompanyOverrides(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)
    eps: float | None = None
    revenue: float | None = Field(default=None, gt=0)
    shares: float | None = Field(default=None, gt=0)
    cash: float | None = Field(default=None, ge=0)
    debt: float | None = Field(default=None, ge=0)
    other_claims: float | None = Field(default=None, ge=0)
    tax_rate: float | None = Field(default=None, ge=0, le=1)


class CompanyCalculation(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)
    snapshot_id: str = Field(pattern=r"^[a-f0-9]{64}$")
    model: Literal["pe", "peg", "dcf"]
    inputs: CompanyOverrides = Field(default_factory=CompanyOverrides)
    scenarios: dict[str, dict[str, float]] = Field(min_length=3, max_length=3)
    years: int = Field(default=5, strict=True)
    terminal_growth: float = Field(default=.02, ge=0, le=.05)
    terminal_roic: float = Field(default=.10, gt=0, le=1)


class AiAssumptionsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", protected_namespaces=())
    snapshot_id: str = Field(pattern=r"^[a-f0-9]{64}$")
    model: str = Field(min_length=1, max_length=100)
    locale: Literal["zh", "en"] = "zh"
    regenerate: bool = False


@router.get("/{symbol}/inputs")
async def company_inputs(symbol: Symbol):
    try:
        data = await company_inputs_service.load(symbol.upper())
        return JSONResponse(data, headers=HEADERS)
    except RuntimeError as exc:
        raise HTTPException(429, "Financial source busy; try again shortly") from exc
    except Exception as exc:
        raise HTTPException(503, "Company financial inputs unavailable; retry shortly") from exc


@router.post("/{symbol}/calculate")
async def company_calculate(symbol: Symbol, command: CompanyCalculation):
    try:
        snapshot = company_inputs_service.snapshot(symbol.upper(), command.snapshot_id)
        return JSONResponse(calculate_company(snapshot, command.model_dump()), headers=HEADERS)
    except LookupError as exc:
        raise HTTPException(409, "Financial snapshot changed; refresh inputs") from exc
    except (ValueError, OverflowError) as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("/{symbol}/ai-assumptions")
async def ai_assumptions(
    symbol: Symbol,
    body: AiAssumptionsRequest,
    user_id: str = Depends(get_current_user_id),
    api_keys: UserApiKeysService = Depends(get_user_api_keys_service),
):
    """AI proposes assumptions only; every value still comes from the deterministic model."""
    # Imported here because this module is heavy and only AI requests need it.
    from app.services.technical_analysis import AiNotConfigured
    try:
        snapshot = company_inputs_service.snapshot(symbol.upper(), body.snapshot_id)
        data = await ai_assumptions_service.generate(
            snapshot, user_id=user_id, model_id=body.model, locale=body.locale, regenerate=body.regenerate,
            user_api_keys=await api_keys.get_keys_dict(user_id),
            persist=lambda record: ValuationAiRuns(get_supabase_service()).save(user_id, symbol.upper(), record))
        return JSONResponse(data, headers=HEADERS)
    except LookupError as exc:
        raise HTTPException(409, "company_snapshot_changed") from exc
    except AiNotConfigured as exc:
        raise HTTPException(503, "ai_not_configured") from exc
    except AiKeyRejected as exc:
        raise HTTPException(400, "ai_key_rejected") from exc
    except AiRateLimited as exc:
        raise HTTPException(429, "ai_rate_limited") from exc
    except AiNotApplicable as exc:
        raise HTTPException(422, "ai_not_applicable") from exc
    except AiAssumptionsInvalid as exc:
        raise HTTPException(502, "ai_assumptions_invalid") from exc
    except TimeoutError as exc:
        raise HTTPException(504, "ai_analysis_timeout") from exc
    except Exception as exc:
        # Provider errors can echo request details; clients get a stable code.
        logger.warning("AI valuation assumptions unavailable for %s (%s)", symbol.upper(), type(exc).__name__)
        raise HTTPException(503, "ai_unavailable") from exc


@router.get("/{symbol}/ai-runs")
async def ai_runs(symbol: Symbol, limit: int = Query(default=20, ge=1, le=50), user_id: str = Depends(get_current_user_id)):
    """This user's saved runs for one company, newest first."""
    try:
        items = await asyncio.to_thread(ValuationAiRuns(get_supabase_service()).list, user_id, symbol.upper(), limit)
    except Exception as exc:
        logger.warning("AI valuation runs unavailable for %s (%s)", symbol.upper(), type(exc).__name__)
        raise HTTPException(503, "ai_runs_unavailable") from exc
    return JSONResponse({"items": items}, headers=HEADERS)


@router.get("/{symbol}/sales-history")
async def sales_history(symbol: Symbol, years: int = Query(default=5, ge=1, le=5)):
    try:
        data = await sales_history_service.load(symbol.upper())
    except RuntimeError as exc:
        raise HTTPException(429, "Financial source busy; try again shortly") from exc
    except Exception as exc:
        logger.warning("Sales history unavailable for %s (%s)", symbol.upper(), type(exc).__name__)
        raise HTTPException(503, "Sales history unavailable; retry shortly") from exc
    if data.get("status") == "available":
        cutoff = date.fromisoformat(data["as_of"])
        start = cutoff.replace(year=cutoff.year-years, day=min(cutoff.day, 28)).isoformat()
        points = [p for p in data["points"] if p["date"] >= start]
        used = {p["event_id"] for p in points}
        data = {**data, "points": points, "events": {k: v for k, v in data["events"].items() if k in used}}
    return JSONResponse(data, headers=HEADERS)


@router.get("/jobs/{job_id}")
async def job_status(job_id: str = Path(pattern=r"^[a-f0-9]{32}$")):
    job = valuation_service.job(job_id)
    if not job:
        raise HTTPException(404, "Valuation job expired; request data again")
    return JSONResponse(job, headers=HEADERS)


@router.get("/{symbol}/summary")
@router.get("/{symbol}/history")
async def read_valuation(symbol: Symbol, years: int = Query(default=3, ge=1, le=5), retry: bool = False):
    status, data = valuation_service.request(symbol.upper(), retry=retry)
    if status == 200 and "points" in data:
        cutoff = date.fromisoformat(data["as_of"])
        try:
            start = cutoff.replace(year=cutoff.year-years).isoformat()
        except ValueError:
            start = cutoff.replace(year=cutoff.year-years, day=28).isoformat()
        points = [p for p in data["points"] if p["date"] >= start]
        event_ids = {p["event_id"] for p in points}
        data = {**data, "points": points, "events": {k: v for k, v in data["events"].items() if k in event_ids}}
    return JSONResponse(data, status_code=status, headers=HEADERS)


@router.post("/{symbol}/simulate")
async def simulate(symbol: Symbol, command: Simulation):
    try:
        data = valuation_service.simulate(symbol.upper(), command.snapshot_id, command.multiples.model_dump(),
                                          command.growth.model_dump(), [d.isoformat() for d in command.target_dates])
        return JSONResponse(data, headers=HEADERS)
    except LookupError as exc:
        raise HTTPException(409, "Snapshot changed or expired; reload valuation") from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
