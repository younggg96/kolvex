"""Translate finished TradingAgents research into the reader's language.

The agents research and debate in English. Afterwards only the reader-facing text is
translated and stored under ``translations[<language>]`` with the same shape as the
record, so the frontend can overlay it field by field and fall back to the original.
"""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, wait
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = {"zh": "Simplified Chinese"}
REPORT_FIELDS = (
    "full_signal", "investment_plan", "trader_plan",
    "market_report", "fundamentals_report", "news_report", "sentiment_report",
)
DEBATE_FIELDS = {
    "investment_debate": ("judge_decision", "bull_history", "bear_history"),
    "risk_debate": ("judge_decision", "aggressive_history", "conservative_history", "neutral_history"),
}
CHUNK_CHARS = 6000
MAX_WORKERS = 4
DEFAULT_TIMEOUT = 300

SYSTEM_PROMPT = """You translate equity research written by AI analysts into {language}.
Rules:
- Output only the translation, with no preface or notes.
- Keep the Markdown structure exactly: headings, lists, tables, bold, links.
- Keep tickers, numbers, currencies, dates, percentages and indicator names (RSI, MACD, EMA, P/E) unchanged.
- Translate BUY / SELL / HOLD as 买入 / 卖出 / 持有 in prose, but keep them unchanged inside a line such as "FINAL TRANSACTION PROPOSAL: **BUY**".
- Use natural, professional financial wording; do not summarize or add content."""


def collect_texts(record: dict[str, Any]) -> dict[str, str]:
    """Flatten the translatable text of a record into ``path -> text``."""
    texts: dict[str, str] = {}
    for field in REPORT_FIELDS:
        value = record.get(field)
        if isinstance(value, str) and value.strip():
            texts[field] = value
    for field, keys in DEBATE_FIELDS.items():
        debate = record.get(field)
        if not isinstance(debate, dict):
            continue
        for key in keys:
            value = debate.get(key)
            if isinstance(value, str) and value.strip():
                texts[f"{field}.{key}"] = value
    return texts


def nest(flat: dict[str, str]) -> dict[str, Any]:
    """Turn ``path -> text`` back into the record's shape."""
    out: dict[str, Any] = {}
    for path, text in flat.items():
        if "." in path:
            field, key = path.split(".", 1)
            out.setdefault(field, {})[key] = text
        else:
            out[path] = text
    return out


def split_chunks(text: str, limit: int = CHUNK_CHARS) -> list[str]:
    """Split on paragraph boundaries so each request stays well under output limits."""
    if len(text) <= limit:
        return [text]
    chunks: list[str] = []
    current = ""
    for paragraph in text.split("\n\n"):
        candidate = f"{current}\n\n{paragraph}" if current else paragraph
        if len(candidate) <= limit:
            current = candidate
            continue
        if current:
            chunks.append(current)
        # A single oversized paragraph is split on lines, then hard-cut as a last resort.
        while len(paragraph) > limit:
            cut = paragraph.rfind("\n", 0, limit)
            cut = cut if cut > 0 else limit
            chunks.append(paragraph[:cut])
            paragraph = paragraph[cut:].lstrip("\n")
        current = paragraph
    if current:
        chunks.append(current)
    return chunks


def _content(message: Any) -> str:
    content = getattr(message, "content", message)
    if isinstance(content, list):
        content = "".join(part.get("text", "") if isinstance(part, dict) else str(part) for part in content)
    return str(content).strip()


def translate_texts(
    invoke: Callable[[list[tuple[str, str]]], Any],
    texts: dict[str, str],
    language: str,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, str]:
    """Translate every text; a field whose chunks fail is left out (the reader sees the original)."""
    target = SUPPORTED_LANGUAGES[language]
    system = SYSTEM_PROMPT.format(language=target)
    jobs = [(path, index, chunk) for path, text in texts.items() for index, chunk in enumerate(split_chunks(text))]
    results: dict[tuple[str, int], str] = {}
    failed: set[str] = set()

    def run(path: str, index: int, chunk: str):
        try:
            translated = _content(invoke([("system", system), ("human", chunk)]))
            if not translated:
                raise ValueError("empty translation")
            results[(path, index)] = translated
        except Exception as error:  # noqa: BLE001 - one field failing must not drop the rest
            logger.warning("[ResearchTranslation] %s chunk %s failed: %s", path, index, error)
            failed.add(path)

    pool = ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="research-translate")
    try:
        futures = [pool.submit(run, *job) for job in jobs]
        _, pending = wait(futures, timeout=timeout)
        for future in pending:
            future.cancel()
    finally:
        pool.shutdown(wait=False, cancel_futures=True)

    out: dict[str, str] = {}
    for path, text in texts.items():
        count = len(split_chunks(text))
        parts = [results.get((path, index)) for index in range(count)]
        if path in failed or any(part is None for part in parts):
            continue
        out[path] = "\n\n".join(parts)  # type: ignore[arg-type]
    return out


def create_translation_llm(provider: str, model: str, api_key: Optional[str]):
    from tradingagents.llm_clients import create_llm_client

    kwargs: dict[str, Any] = {}
    if api_key:
        kwargs["api_key"] = api_key
    return create_llm_client(provider=provider, model=model, **kwargs).get_llm()


def translate_record(
    record: dict[str, Any],
    language: str,
    llm: Any,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """Return ``{"<path>": ...}`` nested translation for one language (may be partial or empty)."""
    if language not in SUPPORTED_LANGUAGES:
        raise ValueError(f"unsupported_language:{language}")
    texts = collect_texts(record)
    if not texts:
        return {}
    started = time.time()
    flat = translate_texts(llm.invoke, texts, language, timeout=timeout)
    logger.info(
        "[ResearchTranslation] %s: %d/%d fields translated to %s in %.1fs",
        record.get("id"), len(flat), len(texts), language, time.time() - started,
    )
    translated = nest(flat)
    if translated:
        translated["translated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return translated
