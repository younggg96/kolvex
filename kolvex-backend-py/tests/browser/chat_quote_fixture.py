"""Local test service for the real Next.js chat and FastAPI routes."""

import json
import os
from types import SimpleNamespace

from fastapi import FastAPI, Request
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage
from postgrest import SyncPostgrestClient

from app.agent import memory
from app.agent.graphs import supervisor
from app.agent.tools import stock_tools
from app.api.routes.chat import routes
from app.services.chat_service import ChatService

USER_ID = "00000000-0000-0000-0000-000000000001"
USER = {"id": USER_ID, "email": "quote-test@example.test", "role": "authenticated",
        "aud": "authenticated", "app_metadata": {}, "user_metadata": {},
        "created_at": "2026-01-01T00:00:00Z"}
FIXTURES = {
    "NVDA": {"current_price": 123.45, "market_time": 1767268800},
    "AMD": {"current_price": 234.56, "market_time": None},
}
postgrest = SyncPostgrestClient(os.environ["QUOTE_TEST_POSTGREST_URL"])
database = SimpleNamespace(table=postgrest.from_)
memory.get_supabase_service = lambda: database


class FixtureModel(FakeMessagesListChatModel):
    def bind_tools(self, tools, **kwargs):
        self.quote_enabled = any(tool.name == "get_stock_quote" for tool in tools)
        self.revenue_enabled = any(tool.name == "get_reported_revenue" for tool in tools)
        return self

    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        if messages[-1].type == "tool" and messages[-1].name == "get_reported_revenue":
            rows = json.loads(messages[-1].content)
            answer = f"Revenue was {rows[0]['value']:,.0f} USD." if isinstance(rows, list) else "No SEC revenue available."
            self.responses = [AIMessage(content=answer)]
        elif messages[-1].type == "tool":
            quote = json.loads(messages[-1].content)
            answer = f"{quote['symbol']} quote is {quote['current_price']} {quote['currency']}."
            if not quote.get("market_time"):
                answer += " Quote time unavailable."
            self.responses = [AIMessage(content=answer)]
        elif "revenue" in messages[-1].content:
            symbol = "AMD" if "AMD" in messages[-1].content else "NVDA"
            response = AIMessage(content="Revenue verification is unavailable with the selected skills.")
            if self.revenue_enabled:
                response = AIMessage(content="", tool_calls=[{
                    "name": "get_reported_revenue", "args": {"symbol": symbol}, "id": "revenue",
                }])
            self.responses = [response]
        elif "AMD" in messages[-1].content:
            self.responses = [self.quote_call("AMD")]
        else:
            self.responses = [self.quote_call("NVDA")]
        return super()._generate(messages, stop, run_manager, **kwargs)

    quote_enabled: bool = True
    revenue_enabled: bool = True

    def quote_call(self, symbol):
        if not self.quote_enabled:
            return AIMessage(content="I could not verify the latest quote with the selected skills.")
        return AIMessage(content="", tool_calls=[{
            "name": "get_stock_quote", "args": {"symbol": symbol}, "id": "quote",
        }])


def fixture_llm(**kwargs):
    return FixtureModel(responses=[])


class QuoteProvider:
    def get_quote(self, symbol):
        return {"symbol": symbol, "currency": "USD", "quote_source": "Yahoo Finance", **FIXTURES[symbol]}


async def financials(symbol):
    source = "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000123/0001045810-26-000123-index.html"
    rows = []
    if symbol == "NVDA":
        for start, end, filed, value, derived in (
            ("2026-07-01", "2026-09-30", "2026-10-15", 300, True),
            ("2026-04-01", "2026-06-30", "2026-08-01", 200_000_000, False),
            ("2026-01-01", "2026-03-31", "2026-05-01", 100_000_000, False),
        ):
            rows.append({"start": start, "period": end, "revenue": value, "sources": {
                "revenue": {"filed": filed, "source_url": source, "derived": derived},
            }})
    return {"symbol": symbol, "currency": "USD", "quarterly": rows, "annual": []}


async def classify(*args, **kwargs):
    return "financial"


async def keys(_user_id):
    return {}


async def no_context(*args):
    return None


supervisor.get_llm = fixture_llm
supervisor._classify_intent = classify
stock_tools.get_yfinance_service = QuoteProvider
stock_tools.sec_client = SimpleNamespace(financials=financials)
routes.turn_context = no_context

app = FastAPI()
app.include_router(routes.router, prefix="/api/v1/chat")
app.dependency_overrides[routes.get_current_user_id] = lambda: USER_ID
app.dependency_overrides[routes.get_chat_service] = lambda: ChatService(database)
app.dependency_overrides[routes.get_user_api_keys_service] = lambda: SimpleNamespace(get_keys_dict=keys)


@app.get("/auth/v1/user")
def user():
    return USER


@app.get("/api/v1/user-api-keys/available-providers")
def providers():
    return {"available_providers": ["deepseek"]}


@app.get("/api/v1/research-workspaces/by-chat/{conversation_id}")
def workspace():
    return {"workspace": None}


@app.get("/rest/v1/{table}")
def mock_profile(table: str, request: Request):
    if "object" in request.headers.get("accept", ""):
        return {"id": USER_ID, "user_id": USER_ID, "email": USER["email"], "role": "user"}
    return []
