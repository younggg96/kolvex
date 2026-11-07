"""Standalone Kronos forecast service.

The main API fetches bars and calls POST /forecast; this service only runs the
model, so torch stays out of the main backend image.
"""

from __future__ import annotations

import asyncio
import hmac
import logging
import os
from contextlib import asynccontextmanager
from typing import List, Literal, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from . import engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("forecast_service")

SERVICE_TOKEN = os.getenv("FORECAST_SERVICE_TOKEN", "")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if os.getenv("KRONOS_PRELOAD", "true").lower() == "true":
        # Load in the background so /health answers while weights load.
        asyncio.get_running_loop().run_in_executor(None, engine.get_predictor)
    yield


app = FastAPI(title="Kolvex Forecast Service", lifespan=lifespan)


class Bar(BaseModel):
    date: str
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    volume: Optional[float] = None


class ForecastRequest(BaseModel):
    bars: List[Bar] = Field(..., min_length=engine.MIN_BARS, max_length=2000)
    interval: Literal["1d", "1wk"] = "1d"
    horizon: int = Field(20, ge=1, le=60)
    samples: int = Field(16, ge=1, le=64)
    temperature: float = Field(1.0, gt=0, le=2)
    top_p: float = Field(0.9, gt=0, le=1)
    seed: Optional[int] = None


@app.get("/health")
def health():
    return {"status": "ok", "model": engine.MODEL_ID, "loaded": engine.is_loaded()}


@app.post("/forecast")
async def run_forecast(body: ForecastRequest, x_forecast_token: str = Header(default="")):
    if SERVICE_TOKEN and not hmac.compare_digest(x_forecast_token, SERVICE_TOKEN):
        raise HTTPException(status_code=401, detail="invalid_token")
    try:
        return await asyncio.to_thread(
            engine.forecast,
            [b.model_dump() for b in body.bars],
            body.interval,
            body.horizon,
            body.samples,
            body.temperature,
            body.top_p,
            body.seed,
        )
    except engine.ForecastInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
