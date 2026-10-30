"""Exercise the real cloud entrypoint and SDK over a local TCP connection."""
import asyncio
import os
from pathlib import Path
import socket
import sys
import unittest

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client


class CloudEntrypointTests(unittest.IsolatedAsyncioTestCase):
    async def test_platform_port_health_auth_and_remote_mcp_protocol(self):
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        token = "test-cloud-transport-key-32-characters-long"
        domain = "kolvex-mcp-test.up.railway.app"
        process = await asyncio.create_subprocess_exec(
            sys.executable, "-m", "mcp_server", "--transport", "streamable-http",
            cwd=str(Path(__file__).resolve().parents[1]),
            env={
                "PATH": os.environ.get("PATH", ""),
                "PORT": str(port),
                "KOLVEX_API_URL": "http://127.0.0.1:8080",
                "KOLVEX_ADMIN_ACCESS_TOKEN": "test-admin-session",
                "KOLVEX_MCP_AUTH_TOKEN": token,
                "RAILWAY_PUBLIC_DOMAIN": domain,
            },
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
        )
        try:
            async with httpx.AsyncClient(base_url=f"http://127.0.0.1:{port}", timeout=2, trust_env=False) as client:
                for attempt in range(100):
                    if process.returncode is not None:
                        self.fail(f"MCP process exited during startup: {process.returncode}")
                    try:
                        health = await client.get("/health", headers={"Host": "healthcheck.railway.app"})
                        if health.status_code == 200:
                            break
                    except httpx.ConnectError:
                        pass
                    await asyncio.sleep(0.05)
                else:
                    self.fail("MCP did not become healthy on the platform PORT")
                self.assertEqual(health.json(), {"status": "ok"})
                self.assertEqual((await client.post("/mcp")).status_code, 401)
            async with httpx.AsyncClient(headers={"Authorization": f"Bearer {token}", "Host": domain}, timeout=5, trust_env=False) as client:
                async with streamable_http_client(f"http://127.0.0.1:{port}/mcp", http_client=client) as (read, write, _):
                    async with ClientSession(read, write) as session:
                        initialized = await session.initialize()
                        self.assertEqual(initialized.serverInfo.name, "Kolvex Content Admin")
                        self.assertEqual(len((await session.list_tools()).tools), 18)
                        result = await session.call_tool("get_content_guide", {"kind": "brief"})
                        self.assertFalse(result.isError)
        finally:
            if process.returncode is None:
                process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=5)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()


if __name__ == "__main__":
    unittest.main()
