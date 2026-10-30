"""Private single-administrator HTTP transport, with a separate MCP credential."""
import secrets
from starlette.responses import JSONResponse


class BearerAuth:
    def __init__(self, app, token: str):
        if len(token) < 32 or any(c.isspace() for c in token):
            raise ValueError("HTTP requires KOLVEX_MCP_AUTH_TOKEN: at least 32 random characters, without whitespace.")
        self.app = app
        self.token = token.encode("utf-8")

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            # Deployment probes reveal only process liveness. MCP stays protected.
            if scope["path"] == "/health" and scope["method"] in {"GET", "HEAD"}:
                response = JSONResponse({"status": "ok"}, headers={"Cache-Control": "no-store"})
                await response(scope, receive, send)
                return
            authorization = next((value for key, value in scope["headers"] if key.lower() == b"authorization"), b"")
            parts = authorization.split()
            if len(parts) != 2 or parts[0].lower() != b"bearer" or not secrets.compare_digest(parts[1], self.token):
                response = JSONResponse({"error": "Unauthorized"}, status_code=401, headers={"WWW-Authenticate": "Bearer"})
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)
