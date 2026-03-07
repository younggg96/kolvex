"""
TradingAgents integration module for Kolvex.
Bridges the TradingAgents multi-agent framework with Kolvex's backend.

All imports are lazy — the module is safe to import even when
the `tradingagents` package is not installed.
"""

import logging

logger = logging.getLogger(__name__)

TRADINGAGENTS_AVAILABLE = False
try:
    import tradingagents  # noqa: F401
    TRADINGAGENTS_AVAILABLE = True
except ImportError:
    logger.info("tradingagents package not installed — Trading Analysis feature disabled")


def build_ta_config(*args, **kwargs):
    from .adapter import build_ta_config as _build
    return _build(*args, **kwargs)


def create_trading_graph(*args, **kwargs):
    from .adapter import create_trading_graph as _create
    return _create(*args, **kwargs)


__all__ = ["build_ta_config", "create_trading_graph", "TRADINGAGENTS_AVAILABLE"]
