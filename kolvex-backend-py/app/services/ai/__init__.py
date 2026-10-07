"""Shared AI clients and JSON utilities for portfolio and market analysis."""
from .config import OLLAMA_BASE_URL, DEFAULT_MODEL, REQUEST_TIMEOUT
from .utils import extract_json_object, extract_json_array
from .client import OllamaClient, OllamaClientSync

__all__ = ["OLLAMA_BASE_URL", "DEFAULT_MODEL", "REQUEST_TIMEOUT", "extract_json_object", "extract_json_array", "OllamaClient", "OllamaClientSync"]
