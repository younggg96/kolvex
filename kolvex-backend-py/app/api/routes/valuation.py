"""Public, read-only pilot data and non-persistent parameter simulation."""
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Path, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.services.valuation.service import valuation_service
from app.services.valuation.company_inputs import company_inputs_service
from app.services.valuation.company_model import calculate_company

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
