"""
TradingAnalysis Service

Manages the lifecycle of TradingAgents multi-agent analyses:
- Create analysis records
- Build TradingAgents config from Kolvex parameters
- Execute analysis in background threads
- Track progress via Redis
- Persist results to Supabase
"""

import asyncio
import json
import logging
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, AsyncGenerator, Optional

from app.agent.config import (
    OPENAI_API_KEY,
    ANTHROPIC_API_KEY,
    DEEPSEEK_API_KEY,
    QWEN_API_KEY,
    GOOGLE_API_KEY,
    KIMI_API_KEY,
    GROK_API_KEY,
)
from app.core.redis import get_redis
from app.core.supabase import get_supabase_service

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# TradingAgents availability check
# ---------------------------------------------------------------------------
TRADINGAGENTS_AVAILABLE = False
try:
    import tradingagents  # noqa: F401
    TRADINGAGENTS_AVAILABLE = True
except ImportError:
    logger.warning("tradingagents package not found — Trading Analysis feature disabled")

# ---------------------------------------------------------------------------
# API-key resolution: user-provided key takes priority over server fallback
# ---------------------------------------------------------------------------
_SERVER_KEY_FALLBACKS: dict[str, str | None] = {
    "openai": OPENAI_API_KEY,
    "anthropic": ANTHROPIC_API_KEY,
    "deepseek": DEEPSEEK_API_KEY,
    "qwen": QWEN_API_KEY,
    "gemini": GOOGLE_API_KEY,
    "kimi": KIMI_API_KEY,
    "grok": GROK_API_KEY,
}


def _resolve_api_key(
    provider: str,
    user_api_keys: Optional[dict[str, str]] = None,
) -> Optional[str]:
    if user_api_keys and provider in user_api_keys:
        return user_api_keys[provider]
    return _SERVER_KEY_FALLBACKS.get(provider)


def build_ta_config(
    provider: str = "openai",
    deep_think_model: str = "gpt-4o",
    quick_think_model: str = "gpt-4o-mini",
    max_debate_rounds: int = 1,
    max_risk_discuss_rounds: int = 1,
    user_api_keys: Optional[dict[str, str]] = None,
) -> dict[str, Any]:
    """Build a TradingAgents config dict from Kolvex parameters.

    Provider names (openai, anthropic, gemini, deepseek, qwen, kimi, grok)
    are passed through directly — the vendored LLM clients handle them.
    """
    from tradingagents.default_config import DEFAULT_CONFIG

    api_key = _resolve_api_key(provider, user_api_keys)
    logger.info(
        f"build_ta_config: provider={provider}, "
        f"key_source={'user' if user_api_keys and provider in user_api_keys else 'server'}, "
        f"key_tail=****{api_key[-4:] if api_key else 'None'}"
    )

    config = DEFAULT_CONFIG.copy()
    config.update({
        "llm_provider": provider,
        "deep_think_llm": deep_think_model,
        "quick_think_llm": quick_think_model,
        "api_key": api_key,
        "max_debate_rounds": max_debate_rounds,
        "max_risk_discuss_rounds": max_risk_discuss_rounds,
    })
    return config


def create_trading_graph(
    config: dict[str, Any],
    selected_analysts: Optional[list[str]] = None,
    callbacks: Optional[list] = None,
):
    """Create a TradingAgentsGraph with the given config."""
    from tradingagents.graph.trading_graph import TradingAgentsGraph

    return TradingAgentsGraph(
        selected_analysts=selected_analysts or ["market", "social", "news", "fundamentals"],
        debug=False,
        config=config,
        callbacks=callbacks,
    )

TABLE = "trading_analyses"
PROGRESS_TTL = 3600
DEFAULT_GRAPH_TIMEOUT = 900
PROVIDER_TIMEOUTS: dict[str, int] = {
    "openai": 600,
    "anthropic": 600,
    "deepseek": 1800,
    "qwen": 1200,
    "kimi": 1200,
    "gemini": 600,
    "grok": 600,
}
_executor = ThreadPoolExecutor(max_workers=3)

NODE_STAGE_MAP: dict[str, tuple[str, str]] = {
    "Market Analyst": ("analysts", "Running Market Analyst..."),
    "tools_market": ("analysts", "Market Analyst gathering data..."),
    "Msg Clear Market": ("analysts", "Market analysis complete"),
    "Social Analyst": ("analysts", "Running Social Media Analyst..."),
    "tools_social": ("analysts", "Social Analyst gathering data..."),
    "Msg Clear Social": ("analysts", "Social analysis complete"),
    "News Analyst": ("analysts", "Running News Analyst..."),
    "tools_news": ("analysts", "News Analyst gathering data..."),
    "Msg Clear News": ("analysts", "News analysis complete"),
    "Fundamentals Analyst": ("analysts", "Running Fundamentals Analyst..."),
    "tools_fundamentals": ("analysts", "Fundamentals Analyst gathering data..."),
    "Msg Clear Fundamentals": ("analysts", "All analyst reports ready"),
    "Bull Researcher": ("debate", "Bull Researcher building case..."),
    "Bear Researcher": ("debate", "Bear Researcher building case..."),
    "Research Manager": ("debate", "Research Manager reviewing debate..."),
    "Trader": ("trader", "Trader formulating plan..."),
    "Aggressive Analyst": ("risk", "Aggressive risk analyst speaking..."),
    "Conservative Analyst": ("risk", "Conservative risk analyst speaking..."),
    "Neutral Analyst": ("risk", "Neutral risk analyst speaking..."),
    "Risk Judge": ("risk", "Risk Manager making final decision..."),
}

DETAIL_PREVIEW_LEN = 300
MAX_STORED_PROGRESS_EVENTS = 200


def _extract_node_detail(node_name: str, node_output: dict) -> dict:
    """Extract meaningful detail from a graph node's output for live progress display."""
    result: dict[str, str] = {}
    messages = node_output.get("messages", [])

    if node_name.startswith("tools_"):
        tool_names = []
        for msg in messages:
            name = getattr(msg, "name", None)
            if name:
                tool_names.append(name)
        if tool_names:
            result["detail_type"] = "tool_result"
            result["detail"] = ", ".join(tool_names)
        return result

    for msg in messages:
        tool_calls = getattr(msg, "tool_calls", None)
        if tool_calls:
            calls_info = []
            for tc in tool_calls:
                name = tc.get("name", "unknown")
                args = tc.get("args", {})
                arg_parts = []
                for k, v in list(args.items())[:3]:
                    if isinstance(v, str) and len(v) < 60:
                        arg_parts.append(f"{k}={v}")
                arg_str = f"({', '.join(arg_parts)})" if arg_parts else ""
                calls_info.append(f"{name}{arg_str}")
            result["detail_type"] = "tool_call"
            result["detail"] = "; ".join(calls_info)
            return result

        content = getattr(msg, "content", None)
        if content and isinstance(content, str) and len(content.strip()) > 20:
            preview = content.strip()[:DETAIL_PREVIEW_LEN]
            if len(content.strip()) > DETAIL_PREVIEW_LEN:
                preview += "..."
            result["detail_type"] = "thinking"
            result["detail"] = preview
            return result

    debate_state = node_output.get("investment_debate_state")
    if isinstance(debate_state, dict):
        response = debate_state.get("current_response", "")
        if response and len(response) > 20:
            preview = response[:DETAIL_PREVIEW_LEN].strip()
            if len(response) > DETAIL_PREVIEW_LEN:
                preview += "..."
            result["detail_type"] = "thinking"
            result["detail"] = preview
            return result

    risk_state = node_output.get("risk_debate_state")
    if isinstance(risk_state, dict):
        for key in [
            "judge_decision",
            "current_aggressive_response",
            "current_conservative_response",
            "current_neutral_response",
        ]:
            val = risk_state.get(key, "")
            if val and len(val) > 20:
                preview = val[:DETAIL_PREVIEW_LEN].strip()
                if len(val) > DETAIL_PREVIEW_LEN:
                    preview += "..."
                result["detail_type"] = "thinking"
                result["detail"] = preview
                return result

    for plan_key in ["trader_investment_plan", "investment_plan"]:
        plan = node_output.get(plan_key)
        if plan and isinstance(plan, str) and len(plan) > 20:
            preview = plan[:DETAIL_PREVIEW_LEN].strip()
            if len(plan) > DETAIL_PREVIEW_LEN:
                preview += "..."
            result["detail_type"] = "thinking"
            result["detail"] = preview
            return result

    for report_key in [
        "market_report", "sentiment_report", "news_report", "fundamentals_report"
    ]:
        report = node_output.get(report_key, "")
        if report and len(report) > 20:
            preview = report[:DETAIL_PREVIEW_LEN].strip()
            if len(report) > DETAIL_PREVIEW_LEN:
                preview += "..."
            result["detail_type"] = "report_preview"
            result["detail"] = preview
            return result

    return result


def _progress_key(analysis_id: str) -> str:
    return f"ta:progress:{analysis_id}"


def _stored_progress_event(event: dict) -> dict:
    stored = dict(event)
    stored.setdefault("created_at", datetime.utcnow().isoformat())
    return stored


def _append_db_progress_event(analysis_id: str, event: dict) -> None:
    """Persist progress history for DB polling fallback.

    This is intentionally best-effort because older deployments may not have
    the progress_events column until the migration is applied.
    """
    try:
        supabase = get_supabase_service()
        result = (
            supabase.table(TABLE)
            .select("progress_events")
            .eq("id", analysis_id)
            .maybe_single()
            .execute()
        )
        current = []
        if result and isinstance(result.data, dict):
            raw_events = result.data.get("progress_events")
            if isinstance(raw_events, list):
                current = raw_events

        current.append(_stored_progress_event(event))
        current = current[-MAX_STORED_PROGRESS_EVENTS:]

        supabase.table(TABLE).update({
            "progress_events": current,
            "progress_stage": event.get("stage"),
            "progress_message": event.get("message", ""),
        }).eq("id", analysis_id).execute()
    except Exception as e:
        logger.warning(
            f"[TradingAnalysis] {analysis_id}: DB progress append failed: {e}"
        )


def _run_graph_sync(
    config: dict[str, Any],
    selected_analysts: list[str],
    ticker: str,
    trade_date: str,
    analysis_id: str,
    redis_progress_key: str,
    timeout_seconds: int = DEFAULT_GRAPH_TIMEOUT,
) -> dict[str, Any]:
    """
    Run TradingAgentsGraph via graph.stream(stream_mode='updates')
    to emit per-node progress events to Redis for SSE consumption.

    When Redis is unavailable (e.g. on Railway), falls back to writing
    progress_stage / progress_message to the DB so the frontend can poll it.
    """
    import redis as sync_redis
    from app.core.config import settings

    rc = None
    try:
        redis_url = settings.REDIS_URL or f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}"
        rc = sync_redis.from_url(redis_url, decode_responses=True)
        rc.ping()
        logger.info(f"[TradingAnalysis] {analysis_id}: sync Redis connected ({redis_url})")
    except Exception as e:
        logger.warning(f"[TradingAnalysis] {analysis_id}: sync Redis unavailable: {e}")
        rc = None

    _last_db_stage: list[str | None] = [None]

    def push_progress(event: dict):
        if rc:
            try:
                full_key = f"{settings.REDIS_KEY_PREFIX}{redis_progress_key}"
                rc.rpush(full_key, json.dumps(event, default=str))
                rc.expire(full_key, PROGRESS_TTL)
            except Exception as e:
                logger.warning(f"[TradingAnalysis] {analysis_id}: progress push failed: {e}")

        _append_db_progress_event(analysis_id, event)

        stage = event.get("stage")
        if stage and stage != _last_db_stage[0]:
            _last_db_stage[0] = stage
            try:
                supabase = get_supabase_service()
                supabase.table(TABLE).update({
                    "progress_stage": stage,
                    "progress_message": event.get("message", ""),
                }).eq("id", analysis_id).execute()
            except Exception as e:
                logger.warning(f"[TradingAnalysis] {analysis_id}: DB progress update failed: {e}")

    push_progress({"stage": "initializing", "message": "Creating analysis graph..."})

    provider = config.get("llm_provider", "openai")
    logger.info(f"[TradingAnalysis] {analysis_id}: creating graph (provider={provider})...")

    graph = create_trading_graph(
        config=config,
        selected_analysts=selected_analysts,
    )

    push_progress({"stage": "analysts", "message": "Starting analyst agents..."})
    logger.info(f"[TradingAnalysis] {analysis_id}: starting stream({ticker}, {trade_date})...")

    init_state = graph.propagator.create_initial_state(ticker, trade_date)
    stream_config = {"recursion_limit": 100}
    start_t = time.time()

    accumulated_state: dict[str, Any] = dict(init_state)
    node_counts: dict[str, int] = {}
    last_pushed_node: str | None = None

    for chunk in graph.graph.stream(
        init_state,
        config=stream_config,
        stream_mode="updates",
    ):
        for node_name, node_output in chunk.items():
            elapsed = time.time() - start_t
            node_counts[node_name] = node_counts.get(node_name, 0) + 1
            count = node_counts[node_name]

            stage, base_message = NODE_STAGE_MAP.get(
                node_name, ("running", f"Running {node_name}...")
            )

            is_tool_node = node_name.startswith("tools_")
            skip_push = is_tool_node and last_pushed_node == node_name

            if not skip_push:
                if is_tool_node:
                    parent = node_name.replace("tools_", "").capitalize()
                    message = f"{parent} Analyst: tool call #{count}"
                elif count > 1:
                    message = f"{base_message} (call {count})"
                else:
                    message = base_message

                logger.info(
                    f"[TradingAnalysis] {analysis_id}: "
                    f"{node_name} #{count} ({elapsed:.0f}s)"
                )
                progress_event: dict[str, Any] = {
                    "stage": stage,
                    "message": message,
                    "node": node_name,
                    "elapsed": round(elapsed),
                }
                try:
                    detail = _extract_node_detail(node_name, node_output)
                    if detail:
                        progress_event.update(detail)
                except Exception:
                    pass
                push_progress(progress_event)
                last_pushed_node = node_name

            if isinstance(node_output, dict):
                accumulated_state.update(node_output)

        if time.time() - start_t > timeout_seconds:
            raise TimeoutError(
                f"Analysis timed out after {timeout_seconds}s"
            )

    decision = graph.process_signal(
        accumulated_state.get("final_trade_decision", "")
    )
    total_elapsed = time.time() - start_t
    logger.info(
        f"[TradingAnalysis] {analysis_id}: stream done in {total_elapsed:.1f}s, "
        f"decision={decision}"
    )

    push_progress({
        "stage": "completed",
        "message": f"Analysis complete: {decision}",
        "decision": decision,
    })

    result = {
        "market_report": accumulated_state.get("market_report", ""),
        "sentiment_report": accumulated_state.get("sentiment_report", ""),
        "news_report": accumulated_state.get("news_report", ""),
        "fundamentals_report": accumulated_state.get("fundamentals_report", ""),
        "investment_debate": _extract_debate(accumulated_state.get("investment_debate_state")),
        "investment_plan": accumulated_state.get("investment_plan", ""),
        "trader_plan": accumulated_state.get("trader_investment_plan", ""),
        "risk_debate": _extract_risk_debate(accumulated_state.get("risk_debate_state")),
        "final_decision": decision,
        "full_signal": accumulated_state.get("final_trade_decision", ""),
    }

    if rc:
        rc.close()

    return result


def _extract_debate(state: Optional[dict]) -> Optional[dict]:
    if not state:
        return None
    return {
        "bull_history": state.get("bull_history", ""),
        "bear_history": state.get("bear_history", ""),
        "history": state.get("history", ""),
        "current_response": state.get("current_response", ""),
        "judge_decision": state.get("judge_decision", ""),
    }


def _extract_risk_debate(state: Optional[dict]) -> Optional[dict]:
    if not state:
        return None
    return {
        "aggressive_history": state.get("aggressive_history", ""),
        "conservative_history": state.get("conservative_history", ""),
        "neutral_history": state.get("neutral_history", ""),
        "history": state.get("history", ""),
        "judge_decision": state.get("judge_decision", ""),
    }


class TradingAnalysisService:
    def __init__(self):
        self._supabase = get_supabase_service()

    async def start_analysis(
        self,
        user_id: str,
        ticker: str,
        trade_date: str,
        provider: str = "openai",
        deep_think_model: str = "gpt-4o",
        quick_think_model: str = "gpt-4o-mini",
        selected_analysts: Optional[list[str]] = None,
        max_debate_rounds: int = 1,
        max_risk_discuss_rounds: int = 1,
        user_api_keys: Optional[dict[str, str]] = None,
    ) -> dict[str, Any]:
        """Create an analysis record and launch background execution."""
        analysts = selected_analysts or ["market", "social", "news", "fundamentals"]
        analysis_id = str(uuid.uuid4())

        logger.info(
            f"[TradingAnalysis] start_analysis: {analysis_id} "
            f"ticker={ticker} provider={provider} user={user_id[:8]}..."
        )

        row = {
            "id": analysis_id,
            "user_id": user_id,
            "ticker": ticker.upper(),
            "trade_date": trade_date,
            "status": "running",
            "selected_analysts": analysts,
            "llm_provider": provider,
            "deep_think_model": deep_think_model,
            "quick_think_model": quick_think_model,
        }

        result = self._supabase.table(TABLE).insert(row).execute()
        record = result.data[0] if result.data else row

        config = build_ta_config(
            provider=provider,
            deep_think_model=deep_think_model,
            quick_think_model=quick_think_model,
            max_debate_rounds=max_debate_rounds,
            max_risk_discuss_rounds=max_risk_discuss_rounds,
            user_api_keys=user_api_keys,
        )

        loop = asyncio.get_running_loop()
        loop.run_in_executor(
            _executor,
            self._run_in_thread,
            analysis_id,
            config,
            analysts,
            ticker.upper(),
            trade_date,
        )

        logger.info(f"[TradingAnalysis] {analysis_id}: background thread submitted")
        return record

    def cleanup_stale_analyses(self) -> int:
        """Mark any 'running' analyses as failed on startup (orphaned from previous server)."""
        try:
            result = (
                self._supabase.table(TABLE)
                .update({
                    "status": "failed",
                    "error_message": "Analysis interrupted by server restart",
                    "completed_at": datetime.utcnow().isoformat(),
                })
                .eq("status", "running")
                .execute()
            )
            count = len(result.data) if result.data else 0
            if count > 0:
                logger.warning(f"[TradingAnalysis] Cleaned up {count} stale 'running' analyses on startup")
            return count
        except Exception as e:
            logger.error(f"[TradingAnalysis] Failed to cleanup stale analyses: {e}")
            return 0

    def _run_in_thread(
        self,
        analysis_id: str,
        config: dict,
        analysts: list[str],
        ticker: str,
        trade_date: str,
    ):
        """Wrapper to run the sync graph and persist results."""
        provider = config.get("llm_provider", "openai")
        timeout = PROVIDER_TIMEOUTS.get(provider, DEFAULT_GRAPH_TIMEOUT)
        watchdog_timeout = timeout + 120  # extra buffer beyond graph timeout
        logger.info(
            f"[TradingAnalysis] Background thread started: {analysis_id} "
            f"ticker={ticker} date={trade_date} analysts={analysts} "
            f"provider={provider} timeout={timeout}s"
        )
        start_time = time.time()
        progress_key = _progress_key(analysis_id)
        completed = threading.Event()

        def _watchdog():
            if not completed.is_set():
                elapsed = time.time() - start_time
                msg = f"Watchdog: analysis hung after {elapsed:.0f}s (limit {watchdog_timeout}s)"
                logger.error(f"[TradingAnalysis] {analysis_id}: {msg}")
                self._mark_failed(analysis_id, f"[Timeout] {msg}", elapsed)
                self._push_failure_progress(progress_key, "Timeout", msg)

        watchdog_timer = threading.Timer(watchdog_timeout, _watchdog)
        watchdog_timer.daemon = True
        watchdog_timer.start()

        try:
            result = _run_graph_sync(
                config=config,
                selected_analysts=analysts,
                ticker=ticker,
                trade_date=trade_date,
                analysis_id=analysis_id,
                redis_progress_key=progress_key,
                timeout_seconds=timeout,
            )

            completed.set()
            duration = time.time() - start_time
            update = {
                "status": "completed",
                "progress_stage": "completed",
                "progress_message": None,
                "market_report": result["market_report"],
                "sentiment_report": result["sentiment_report"],
                "news_report": result["news_report"],
                "fundamentals_report": result["fundamentals_report"],
                "investment_debate": result["investment_debate"],
                "investment_plan": result["investment_plan"],
                "trader_plan": result["trader_plan"],
                "risk_debate": result["risk_debate"],
                "final_decision": result["final_decision"],
                "full_signal": result["full_signal"],
                "duration_seconds": round(duration, 2),
                "completed_at": datetime.utcnow().isoformat(),
            }

            supabase = get_supabase_service()
            supabase.table(TABLE).update(update).eq("id", analysis_id).execute()
            logger.info(f"Analysis {analysis_id} completed: {result['final_decision']} in {duration:.1f}s")

        except BaseException as e:
            completed.set()
            duration = time.time() - start_time
            error_type = type(e).__name__
            logger.error(
                f"Analysis {analysis_id} failed ({error_type}) after {duration:.1f}s: {e}",
                exc_info=True,
            )

            self._mark_failed(analysis_id, f"[{error_type}] {e}", duration)
            self._push_failure_progress(progress_key, error_type, str(e))
        finally:
            watchdog_timer.cancel()

    @staticmethod
    def _mark_failed(analysis_id: str, error_msg: str, duration: float):
        try:
            supabase = get_supabase_service()
            supabase.table(TABLE).update({
                "status": "failed",
                "progress_stage": "failed",
                "progress_message": None,
                "error_message": error_msg[:2000],
                "duration_seconds": round(duration, 2),
                "completed_at": datetime.utcnow().isoformat(),
            }).eq("id", analysis_id).execute()
        except Exception as db_err:
            logger.error(f"Failed to update error status for {analysis_id}: {db_err}")

    @staticmethod
    def _push_failure_progress(progress_key: str, error_type: str, error_msg: str):
        analysis_id = progress_key.replace("ta:progress:", "", 1)
        failure_event = {
            "stage": "done",
            "status": "failed",
            "error_message": f"[{error_type}] {error_msg[:500]}",
        }
        _append_db_progress_event(analysis_id, failure_event)
        try:
            import redis as sync_redis
            from app.core.config import settings
            redis_url = settings.REDIS_URL or f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}"
            rc = sync_redis.from_url(redis_url, decode_responses=True)
            full_key = f"{settings.REDIS_KEY_PREFIX}{progress_key}"
            rc.rpush(full_key, json.dumps(failure_event))
            rc.expire(full_key, PROGRESS_TTL)
            rc.close()
        except Exception:
            pass

    async def get_analysis(self, analysis_id: str, user_id: str) -> Optional[dict[str, Any]]:
        """Get a single analysis by ID."""
        try:
            result = (
                self._supabase.table(TABLE)
                .select("*")
                .eq("id", analysis_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
            return result.data if result else None
        except Exception as e:
            logger.warning(f"get_analysis({analysis_id}) failed: {e}")
            return None

    async def list_analyses(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
        ticker: Optional[str] = None,
    ) -> dict[str, Any]:
        """List analyses for a user with optional ticker filter."""
        query = (
            self._supabase.table(TABLE)
            .select("id, ticker, trade_date, status, selected_analysts, llm_provider, final_decision, duration_seconds, created_at, completed_at, error_message, is_published, published_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
        )

        if ticker:
            query = query.eq("ticker", ticker.upper())

        count_q = self._supabase.table(TABLE).select("id", count="exact").eq("user_id", user_id)
        if ticker:
            count_q = count_q.eq("ticker", ticker.upper())
        count_result = count_q.execute()
        total = count_result.count or 0

        result = query.range(offset, offset + limit - 1).execute()

        return {
            "items": result.data or [],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    async def delete_analysis(self, analysis_id: str, user_id: str) -> bool:
        """Delete an analysis."""
        result = (
            self._supabase.table(TABLE)
            .delete()
            .eq("id", analysis_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(result.data)

    async def publish_analysis(self, analysis_id: str, user_id: str) -> Optional[dict[str, Any]]:
        """Publish an analysis so all users can view it."""
        try:
            result = (
                self._supabase.table(TABLE)
                .update({
                    "is_published": True,
                    "published_at": datetime.utcnow().isoformat(),
                })
                .eq("id", analysis_id)
                .eq("user_id", user_id)
                .eq("status", "completed")
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.warning(f"publish_analysis({analysis_id}) failed: {e}")
            return None

    async def unpublish_analysis(self, analysis_id: str, user_id: str) -> Optional[dict[str, Any]]:
        """Unpublish an analysis, making it private again."""
        try:
            result = (
                self._supabase.table(TABLE)
                .update({
                    "is_published": False,
                    "published_at": None,
                })
                .eq("id", analysis_id)
                .eq("user_id", user_id)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.warning(f"unpublish_analysis({analysis_id}) failed: {e}")
            return None

    async def list_published_analyses(
        self,
        limit: int = 20,
        offset: int = 0,
        ticker: Optional[str] = None,
    ) -> dict[str, Any]:
        """List all published analyses (public, no auth required)."""
        select_fields = (
            "id, user_id, ticker, trade_date, status, selected_analysts, "
            "llm_provider, final_decision, duration_seconds, "
            "created_at, completed_at, published_at, is_published"
        )
        query = (
            self._supabase.table(TABLE)
            .select(select_fields)
            .eq("is_published", True)
            .eq("status", "completed")
            .order("published_at", desc=True)
        )

        if ticker:
            query = query.eq("ticker", ticker.upper())

        count_q = (
            self._supabase.table(TABLE)
            .select("id", count="exact")
            .eq("is_published", True)
            .eq("status", "completed")
        )
        if ticker:
            count_q = count_q.eq("ticker", ticker.upper())
        count_result = count_q.execute()
        total = count_result.count or 0

        result = query.range(offset, offset + limit - 1).execute()
        items = result.data or []

        self._attach_authors(items)

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    async def get_published_analysis(self, analysis_id: str) -> Optional[dict[str, Any]]:
        """Get a single published analysis (public access, no user_id check)."""
        try:
            result = (
                self._supabase.table(TABLE)
                .select("*")
                .eq("id", analysis_id)
                .eq("is_published", True)
                .maybe_single()
                .execute()
            )
            record = result.data if result else None
            if record:
                self._attach_authors([record])
            return record
        except Exception as e:
            logger.warning(f"get_published_analysis({analysis_id}) failed: {e}")
            return None

    def _attach_authors(self, items: list[dict[str, Any]]) -> None:
        """Enrich a list of analysis dicts with author profile info."""
        user_ids = list({item["user_id"] for item in items if item.get("user_id")})
        if not user_ids:
            return
        try:
            profiles_result = (
                self._supabase.table("user_profiles")
                .select("id, username, full_name, avatar_url")
                .in_("id", user_ids)
                .execute()
            )
            profiles_map = {p["id"]: p for p in (profiles_result.data or [])}
            for item in items:
                profile = profiles_map.get(item.get("user_id"))
                if profile:
                    item["author"] = {
                        "id": profile["id"],
                        "username": profile.get("username"),
                        "full_name": profile.get("full_name"),
                        "avatar_url": profile.get("avatar_url"),
                    }
        except Exception as e:
            logger.warning(f"_attach_authors failed: {e}")

    async def get_analysis_status(self, analysis_id: str) -> Optional[dict[str, Any]]:
        """Get analysis status without user_id check (service-level)."""
        try:
            result = (
                self._supabase.table(TABLE)
                .select("id, status, final_decision, error_message, progress_stage, progress_message, progress_events")
                .eq("id", analysis_id)
                .maybe_single()
                .execute()
            )
            return result.data if result else None
        except Exception as e:
            logger.warning(
                f"get_analysis_status({analysis_id}) with progress_events failed: {e}"
            )
            try:
                result = (
                    self._supabase.table(TABLE)
                    .select("id, status, final_decision, error_message, progress_stage, progress_message")
                    .eq("id", analysis_id)
                    .maybe_single()
                    .execute()
                )
                return result.data if result else None
            except Exception as fallback_error:
                logger.warning(
                    f"get_analysis_status({analysis_id}) failed: {fallback_error}"
                )
                return None

    async def stream_progress(
        self, analysis_id: str, max_duration: int = 2100
    ) -> AsyncGenerator[dict, None]:
        """Yield progress events from Redis for SSE streaming.

        When Redis is unavailable, falls back to polling the DB for
        progress_stage changes and emitting synthetic SSE events.

        Args:
            analysis_id: The analysis ID to stream progress for.
            max_duration: Maximum stream duration in seconds (default 35 min,
                          must exceed the longest provider timeout).
        """
        redis = get_redis()
        key = _progress_key(analysis_id)
        cursor = 0
        start = time.time()
        iteration = 0
        ever_received_events = False
        last_db_stage: str | None = None
        db_cursor = 0

        logger.info(
            f"[StreamProgress] Starting stream for {analysis_id}, "
            f"redis_connected={redis.is_connected}, key={key}"
        )

        while (time.time() - start) < max_duration:
            events = await redis.lrange(key, cursor, -1)
            if events:
                ever_received_events = True
                for raw in events:
                    try:
                        yield json.loads(raw) if isinstance(raw, str) else raw
                    except (json.JSONDecodeError, TypeError):
                        yield {"stage": "info", "message": str(raw)}
                cursor += len(events)

            should_check_db = (
                iteration % 3 == 0 if redis.is_connected else True
            )

            if should_check_db:
                record = await self.get_analysis_status(analysis_id)
                if record is None:
                    logger.warning(f"[StreamProgress] {analysis_id}: record not found")
                    yield {
                        "stage": "done",
                        "status": "failed",
                        "error_message": "Analysis record not found (may have been deleted).",
                    }
                    return

                db_events = record.get("progress_events")
                if (
                    isinstance(db_events, list)
                    and not ever_received_events
                    and db_cursor < len(db_events)
                ):
                    for event in db_events[db_cursor:]:
                        if isinstance(event, dict):
                            yield event
                        else:
                            yield {"stage": "info", "message": str(event)}
                    db_cursor = len(db_events)

                if record.get("status") in ("completed", "failed"):
                    logger.info(
                        f"[StreamProgress] {analysis_id}: "
                        f"status={record['status']}, decision={record.get('final_decision')}"
                    )
                    yield {
                        "stage": "done",
                        "status": record["status"],
                        "final_decision": record.get("final_decision"),
                        "error_message": record.get("error_message"),
                    }
                    return

                db_stage = record.get("progress_stage")
                if db_stage and db_stage != last_db_stage and not ever_received_events:
                    last_db_stage = db_stage
                    yield {
                        "stage": db_stage,
                        "message": record.get("progress_message", ""),
                    }

            elapsed = time.time() - start
            if not ever_received_events and elapsed > 30 and iteration % 3 == 0:
                logger.warning(
                    f"[StreamProgress] {analysis_id}: no Redis events after "
                    f"{elapsed:.0f}s (redis_connected={redis.is_connected})"
                )

            iteration += 1
            await asyncio.sleep(3 if not redis.is_connected else 5)

        yield {
            "stage": "done",
            "status": "timeout",
            "error_message": "Progress stream timed out. Refresh the page to check results.",
        }


_service: Optional[TradingAnalysisService] = None


def get_trading_analysis_service() -> TradingAnalysisService:
    global _service
    if _service is None:
        _service = TradingAnalysisService()
    return _service
