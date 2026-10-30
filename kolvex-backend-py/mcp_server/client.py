"""Only server-configured credentials and fixed API routes reach Kolvex."""
from dataclasses import dataclass, field
import json
from urllib.parse import urlsplit

import httpx
from mcp.server.fastmcp.exceptions import ToolError


@dataclass(frozen=True)
class Settings:
    api_url: str
    admin_token: str = field(repr=False)

    def __post_init__(self):
        parsed = urlsplit(self.api_url)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
            or parsed.path.rstrip("/") not in {"", "/api/v1"}
        ):
            raise ValueError("KOLVEX_API_URL must be a backend origin, optionally ending in /api/v1.")
        if parsed.scheme == "http" and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
            raise ValueError("KOLVEX_API_URL requires HTTPS except for localhost.")
        if not self.admin_token.strip() or any(c.isspace() for c in self.admin_token):
            raise ValueError("Set KOLVEX_ADMIN_ACCESS_TOKEN to an administrator's access token.")
        object.__setattr__(self, "api_url", f"{parsed.scheme}://{parsed.netloc}")


class KolvexClient:
    def __init__(self, settings: Settings, *, transport: httpx.AsyncBaseTransport | None = None):
        self.settings = settings
        self.transport = transport

    async def request(self, method: str, path: str, *, params=None, document=None, revision=None):
        headers = {"Authorization": f"Bearer {self.settings.admin_token}"}
        if revision is not None:
            if not str(revision).isdigit() or int(revision) < 1:
                raise ToolError("revision must be the positive revision returned by get_brief.")
            headers["If-Match"] = str(revision)
        if document is not None:
            try:
                encoded = json.dumps(document, ensure_ascii=False, allow_nan=False).encode("utf-8")
            except (ValueError, TypeError) as exc:
                raise ToolError("Content must be valid, finite JSON.") from exc
            limit = 1024 * 1024 if "/market-events" in path else 2 * 1024 * 1024
            if len(encoded) > limit:
                raise ToolError(f"Content exceeds the {limit // (1024 * 1024)} MB limit.")
        clean_params = {key: value for key, value in (params or {}).items() if value is not None}
        # No redirects, ambient proxy credentials or automatic write retries.
        async with httpx.AsyncClient(
            base_url=self.settings.api_url,
            headers=headers,
            timeout=httpx.Timeout(60.0, connect=10.0),
            follow_redirects=False,
            trust_env=False,
            transport=self.transport,
        ) as client:
            try:
                response = await client.request(method, path, params=clean_params, json=document)
            except httpx.RequestError as exc:
                raise ToolError(
                    "Kolvex API is unavailable or timed out. For a write, read back the content "
                    "before retrying: the operation may already have succeeded."
                ) from exc
        if response.is_redirect:
            raise ToolError("Kolvex API redirected the request. Configure the final backend URL.")
        if response.status_code in {401, 403}:
            message = (
                "Administrator session is invalid or expired. Replace KOLVEX_ADMIN_ACCESS_TOKEN and restart."
                if response.status_code == 401 else "Admin access required. The current account cannot perform this operation."
            )
            raise ToolError(message)
        try:
            data = response.json() if response.content else {}
        except ValueError as exc:
            raise ToolError(f"Kolvex returned a non-JSON response (HTTP {response.status_code}).") from exc
        if response.is_error:
            if response.status_code >= 500:
                raise ToolError(
                    f"Kolvex API failed (HTTP {response.status_code}). Read back before retrying a write."
                )
            detail = data.get("detail", "Request rejected") if isinstance(data, dict) else "Request rejected"
            safe_detail = str(detail).replace(self.settings.admin_token, "[redacted]")[:2000]
            raise ToolError(f"Kolvex HTTP {response.status_code}: {safe_detail}")
        return data


def content_id(value: str) -> str:
    """IDs are path segments, never paths, queries or percent-encoded routes."""
    import re
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,200}", value):
        raise ToolError("Invalid content ID; use the exact ID returned by a list tool.")
    return value
