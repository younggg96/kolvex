"""MCP protocol + HTTP adapter contracts. No real credentials or database writes."""
import json
from pathlib import Path
import sys
import unittest

import httpx
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.server.fastmcp.exceptions import ToolError
from mcp.shared.memory import create_connected_server_and_client_session

from mcp_server.client import KolvexClient, Settings, content_id
from mcp_server.__main__ import http_options, http_port
from mcp_server.guides import GUIDES
from mcp_server.http import BearerAuth
from mcp_server.server import create_server

ADMIN_TOKEN = "test-administrator-session"
MCP_TOKEN = "test-mcp-transport-key-32-characters-long"
BACKEND = Path(__file__).resolve().parents[1]


def text_result(result):
    return "\n".join(item.text for item in result.content if item.type == "text")


class SettingsTests(unittest.TestCase):
    def test_cloud_port_and_explicit_override(self):
        self.assertEqual(http_port(None, {}), 8081)
        self.assertEqual(http_port(None, {"PORT": "12345"}), 12345)
        self.assertEqual(http_port(9876, {"PORT": "12345"}), 9876)
        for value in ["not-a-port", "0", "65536"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                http_port(None, {"PORT": value})

    def test_cloud_hostname_and_custom_origins_stay_restricted(self):
        options = http_options({"RAILWAY_PUBLIC_DOMAIN": "kolvex-mcp.example.up.railway.app", "KOLVEX_MCP_ALLOWED_HOSTS": "mcp.example.com", "KOLVEX_MCP_ALLOWED_ORIGINS": "https://client.example.com"})
        self.assertTrue(options.enable_dns_rebinding_protection)
        self.assertEqual(options.allowed_hosts, ["mcp.example.com", "kolvex-mcp.example.up.railway.app"])
        self.assertEqual(options.allowed_origins, ["https://client.example.com"])
        for value in ["https://other.example", "user@other.example", "example.com:8080", "*.example.com", "host.example/extra", "host.example#fragment", "bad host"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                http_options({"RAILWAY_PUBLIC_DOMAIN": value})

    def test_only_backend_origins_and_https_remote(self):
        for url in ["http://localhost:8080", "http://127.0.0.1:8080/api/v1/", "https://api.example.com"]:
            with self.subTest(url=url):
                self.assertNotIn("/api/v1", Settings(url, ADMIN_TOKEN).api_url)
        for url in ["http://api.example.com", "https://user:pass@example.com", "https://example.com?token=secret", "https://example.com/#fragment", "file:///tmp/local", "https://example.com/api/other"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                Settings(url, ADMIN_TOKEN)
        self.assertNotIn(ADMIN_TOKEN, repr(Settings("http://localhost:8080", ADMIN_TOKEN)))
        with self.assertRaises(ValueError):
            Settings("http://localhost:8080", "")

    def test_ids_cannot_change_routes(self):
        for value in ["../users", "..", "/admin", "id?x=y", "id#hash", "%2e%2e", "id\\other", ""]:
            with self.subTest(value=value), self.assertRaises(ToolError):
                content_id(value)
        self.assertEqual(content_id("intraday-2026-10-29"), "intraday-2026-10-29")


class MCPTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.requests = []
        self.failure = None
        self.preview_errors = []

        def handle(request):
            self.requests.append(request)
            self.assertEqual(request.headers["authorization"], f"Bearer {ADMIN_TOKEN}")
            if self.failure:
                return httpx.Response(self.failure[0], json={"detail": self.failure[1]})
            path = request.url.path
            if path == "/openapi.json":
                return httpx.Response(200, json={"components": {"schemas": {"CreatorUpdate": {"type": "object"}, "OpinionWrite": {"type": "object"}, "PriceTargetInput": {"type": "object"}}}})
            if path.endswith("/validate"):
                data = {"errors": self.preview_errors} if "youtube-opinions" in path else {"payload": {**json.loads(request.content), "normalized": True}}
                return httpx.Response(200, json=data)
            if path.endswith("/intraday-2026-10-29") and request.method == "GET":
                return httpx.Response(200, json={"payload": GUIDES["brief"]["example"], "revision": "3"})
            return httpx.Response(200, json={"ok": True, "items": [], "revision": "4"})

        self.api = KolvexClient(Settings("http://localhost:8080/api/v1", ADMIN_TOKEN), transport=httpx.MockTransport(handle))
        self.server = create_server(self.api)

    async def test_handshake_tools_and_effect_annotations(self):
        async with create_connected_server_and_client_session(self.server) as session:
            tools = {tool.name: tool for tool in (await session.list_tools()).tools}
            self.assertEqual(len(tools), 18)
            self.assertTrue(tools["validate_brief"].annotations.readOnlyHint)
            self.assertTrue(tools["delete_brief"].annotations.destructiveHint)
            self.assertFalse(tools["save_market_events"].annotations.readOnlyHint)
            self.assertTrue(tools["import_youtube_opinions"].annotations.destructiveHint)
            self.assertTrue(tools["import_youtube_opinions"].annotations.openWorldHint)
            schema = tools["update_brief"].inputSchema
            self.assertIn("revision", schema["required"])
            self.assertEqual(schema["properties"]["revision"]["pattern"], "^[1-9][0-9]*$")
        self.assertEqual(self.requests, [])

    async def test_read_validate_update_and_revision_forwarding(self):
        async with create_connected_server_and_client_session(self.server) as session:
            result = await session.call_tool("get_brief", {"brief_id": "intraday-2026-10-29"})
            current = json.loads(text_result(result))
            current["payload"]["brief"]["title"] = "Updated title"
            result = await session.call_tool("update_brief", {"brief_id": "intraday-2026-10-29", "revision": current["revision"], "document": current["payload"]})
            self.assertFalse(result.isError)
        self.assertEqual([r.method for r in self.requests], ["GET", "POST", "PUT"])
        self.assertEqual(self.requests[-1].headers["if-match"], "3")
        self.assertTrue(json.loads(self.requests[-1].content)["normalized"])
        self.assertEqual(self.requests[-1].url.path, "/api/v1/admin/briefs/intraday-2026-10-29")

    async def test_all_other_tools_use_the_expected_routes(self):
        cases = [
            ("list_briefs", {"page": 2, "brief_type": "intraday"}, "GET", "/admin/briefs"),
            ("validate_brief", {"document": {}}, "POST", "/admin/briefs/validate"),
            ("create_brief", {"document": {}}, "POST", "/admin/briefs"),
            ("delete_brief", {"brief_id": "intraday-2026-10-29", "revision": "4"}, "DELETE", "/admin/briefs/intraday-2026-10-29"),
            ("list_creators", {}, "GET", "/youtube-opinions/creators"),
            ("update_creator", {"channel_id": "UCtest", "changes": {"channel_title": "New", "channel_avatar_url": None}}, "PATCH", "/youtube-opinions/creators/UCtest"),
            ("list_creator_opinions", {"channel_id": "UCtest"}, "GET", "/youtube-opinions/creators/UCtest/opinions"),
            ("create_opinion", {"channel_id": "UCtest", "document": {}}, "POST", "/youtube-opinions/creators/UCtest/opinions"),
            ("update_opinion", {"opinion_id": "opinion-id", "document": {}}, "PATCH", "/youtube-opinions/opinions/opinion-id"),
            ("delete_opinion", {"opinion_id": "opinion-id"}, "DELETE", "/youtube-opinions/opinions/opinion-id"),
            ("validate_youtube_import", {"document": [{"video": {}}]}, "POST", "/youtube-opinions/validate"),
            ("import_youtube_opinions", {"document": [{"video": {}}]}, "POST", "/youtube-opinions/upload"),
            ("list_market_events", {"page": 3}, "GET", "/admin/market-events"),
            ("validate_market_events", {"document": {}}, "POST", "/admin/market-events/validate"),
            ("save_market_events", {"document": {}}, "POST", "/admin/market-events"),
        ]
        async with create_connected_server_and_client_session(self.server) as session:
            for name, arguments, method, suffix in cases:
                with self.subTest(tool=name):
                    result = await session.call_tool(name, arguments)
                    self.assertFalse(result.isError, text_result(result))
                    request = self.requests[-1]
                    self.assertEqual(request.method, method)
                    self.assertEqual(request.url.path, "/api/v1" + suffix)
                    if name == "list_briefs":
                        self.assertEqual(dict(request.url.params), {"page": "2", "type": "intraday"})
                    if name == "update_creator":
                        self.assertEqual(json.loads(request.content), arguments["changes"])
                    if name == "delete_brief":
                        self.assertEqual(request.headers["if-match"], "4")
            for kind in GUIDES:
                result = await session.call_tool("get_content_guide", {"kind": kind})
                self.assertFalse(result.isError)
                if kind in {"creator", "opinion"}:
                    self.assertIn("schemas", json.loads(text_result(result)))

    async def test_auth_conflict_and_validation_failures_are_tool_errors(self):
        async with create_connected_server_and_client_session(self.server) as session:
            for status in [401, 403, 409, 422, 503]:
                self.failure = status, f"rejected {ADMIN_TOKEN}"
                with self.subTest(status=status):
                    result = await session.call_tool("create_brief", {"document": {}})
                    self.assertTrue(result.isError)
                    self.assertNotIn(ADMIN_TOKEN, text_result(result))
                    self.assertEqual(self.requests[-1].url.path, "/api/v1/admin/briefs/validate")
            self.failure = 409, "Brief changed by another administrator"
            result = await session.call_tool("delete_brief", {"brief_id": "intraday-2026-10-29", "revision": "1"})
            self.assertTrue(result.isError)
            self.assertIn("409", text_result(result))

    async def test_invalid_arguments_and_preview_errors_do_not_write(self):
        async with create_connected_server_and_client_session(self.server) as session:
            for name, args in [
                ("get_brief", {"brief_id": "../../users"}),
                ("list_briefs", {"page": 0}),
                ("list_briefs", {"brief_type": "weekly"}),
                ("delete_brief", {"brief_id": "a", "revision": "0"}),
                ("delete_brief", {"brief_id": "a"}),
            ]:
                with self.subTest(tool=name, args=args):
                    self.assertTrue((await session.call_tool(name, args)).isError)
            self.assertEqual(self.requests, [])
            self.preview_errors = [{"index": 0, "message": "invalid video"}]
            self.assertTrue((await session.call_tool("import_youtube_opinions", {"document": {}})).isError)
            self.assertEqual(len(self.requests), 1)
            self.assertTrue(self.requests[0].url.path.endswith("/validate"))

    async def test_large_payload_and_nonfinite_numbers_are_rejected(self):
        for path, document in [
            ("/api/v1/admin/briefs/validate", {"text": "x" * (2 * 1024 * 1024)}),
            ("/api/v1/admin/market-events/validate", {"text": "x" * (1024 * 1024)}),
            ("/api/v1/admin/briefs/validate", {"number": float("nan")}),
        ]:
            with self.subTest(path=path), self.assertRaises(ToolError):
                await self.api.request("POST", path, document=document)
        self.assertEqual(self.requests, [])

    async def test_redirects_non_json_and_network_errors_are_safe(self):
        for response in [httpx.Response(302, headers={"location": "https://other.example.com"}), httpx.Response(502, text="upstream private debug info")]:
            api = KolvexClient(self.api.settings, transport=httpx.MockTransport(lambda _: response))
            with self.assertRaises(ToolError) as error:
                await api.request("GET", "/api/v1/admin/briefs")
            self.assertNotIn("private debug info", str(error.exception))
        def timeout(request):
            raise httpx.ReadTimeout("private debug info", request=request)
        api = KolvexClient(self.api.settings, transport=httpx.MockTransport(timeout))
        with self.assertRaisesRegex(ToolError, "read back"):
            await api.request("POST", "/api/v1/admin/briefs", document={})

    async def test_http_auth_handshake_and_tool_call(self):
        inner = self.server.streamable_http_app()
        app = BearerAuth(inner, MCP_TOKEN)
        async with inner.router.lifespan_context(inner):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://localhost:8081") as client:
                for auth in [None, "Bearer wrong", f"Bearer {ADMIN_TOKEN}"]:
                    headers = {"Authorization": auth} if auth else {}
                    self.assertEqual((await client.post("/mcp", headers=headers)).status_code, 401)
                headers = {"Authorization": f"Bearer {MCP_TOKEN}", "Accept": "application/json, text/event-stream", "MCP-Protocol-Version": "2025-03-26"}
                response = await client.post("/mcp", headers=headers, json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"}}})
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json()["result"]["serverInfo"]["name"], "Kolvex Content Admin")
                response = await client.post("/mcp", headers=headers, json={"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "list_briefs", "arguments": {}}})
                self.assertEqual(response.status_code, 200, response.text)
                self.assertFalse(response.json()["result"]["isError"])
                # The MCP credential never reaches the backend; only the admin session does.
                self.assertNotIn(MCP_TOKEN, self.requests[-1].headers["authorization"])
                response = await client.post("/mcp", headers={**headers, "Origin": "https://evil.example.com"}, json={"jsonrpc": "2.0", "id": 3, "method": "tools/list"})
                self.assertEqual(response.status_code, 403)

    async def test_public_health_does_not_expose_content_or_bypass_mcp_auth(self):
        app = BearerAuth(self.server.streamable_http_app(), MCP_TOKEN)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://localhost:8081") as client:
            response = await client.get("/health", headers={"Host": "healthcheck.railway.app"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {"status": "ok"})
            self.assertEqual(response.headers["cache-control"], "no-store")
            self.assertEqual((await client.head("/health")).status_code, 200)
            for method, path in [("POST", "/health"), ("POST", "/mcp"), ("GET", "/health/mcp"), ("GET", "/health/")]:
                with self.subTest(method=method, path=path):
                    self.assertEqual((await client.request(method, path)).status_code, 401)
        self.assertEqual(self.requests, [])

    async def test_stdio_process_can_initialize_and_list_tools(self):
        params = StdioServerParameters(command=sys.executable, args=["-m", "mcp_server"], cwd=str(BACKEND), env={"KOLVEX_API_URL": "http://localhost:8080", "KOLVEX_ADMIN_ACCESS_TOKEN": ADMIN_TOKEN})
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                response = await session.initialize()
                self.assertEqual(response.serverInfo.name, "Kolvex Content Admin")
                self.assertEqual(len((await session.list_tools()).tools), 18)


if __name__ == "__main__":
    unittest.main()
