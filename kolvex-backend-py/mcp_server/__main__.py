import argparse
import json
import logging
import os
from pathlib import Path
import sys

from dotenv import load_dotenv
from mcp.server.transport_security import TransportSecuritySettings

from .client import KolvexClient, Settings
from .http import BearerAuth
from .server import create_server


def http_options(environ):
    hosts = [value.strip() for value in environ.get("KOLVEX_MCP_ALLOWED_HOSTS", "localhost:*,127.0.0.1:*,[::1]:*").split(",") if value.strip()]
    # Railway provides the assigned public hostname after a domain is generated.
    public_domain = environ.get("RAILWAY_PUBLIC_DOMAIN", "").strip()
    if public_domain and public_domain not in hosts:
        from urllib.parse import urlsplit
        parsed = urlsplit(f"https://{public_domain}")
        if parsed.netloc != public_domain or parsed.hostname != public_domain or any(c.isspace() for c in public_domain) or "*" in public_domain:
            raise ValueError("RAILWAY_PUBLIC_DOMAIN must contain only the assigned public hostname.")
        hosts.append(public_domain)
    origins = [value.strip() for value in environ.get("KOLVEX_MCP_ALLOWED_ORIGINS", "").split(",") if value.strip()]
    return TransportSecuritySettings(enable_dns_rebinding_protection=True, allowed_hosts=hosts, allowed_origins=origins)


def http_port(argument, environ):
    port = argument if argument is not None else int(environ.get("PORT", "8081"))
    if not 1 <= port <= 65535:
        raise ValueError("HTTP port must be between 1 and 65535.")
    return port


def main():
    parser = argparse.ArgumentParser(description="Kolvex administrator content MCP server")
    parser.add_argument("--env-file", help="Explicit MCP environment file; backend .env is never loaded implicitly")
    parser.add_argument("--transport", choices=["stdio", "streamable-http"], default="stdio")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, help="HTTP port; defaults to PORT, then 8081")
    parser.add_argument("--print-client-config", action="store_true", help="Print a stdio client configuration with absolute paths and no secrets")
    args = parser.parse_args()
    if args.env_file:
        if not os.path.isfile(args.env_file):
            parser.error("--env-file does not exist")
        load_dotenv(args.env_file, override=False)
    if args.print_client_config:
        if not args.env_file:
            parser.error("--print-client-config requires --env-file")
        print(json.dumps({"mcpServers": {"kolvex-admin": {
            "command": sys.executable,
            "args": ["-m", "mcp_server", "--env-file", str(Path(args.env_file).resolve())],
            "cwd": str(Path(__file__).resolve().parents[1]),
        }}}, ensure_ascii=False, indent=2))
        return
    logging.basicConfig(level=logging.WARNING)  # stderr only; stdout belongs to stdio MCP.
    try:
        settings = Settings(os.getenv("KOLVEX_API_URL", "http://127.0.0.1:8080"), os.getenv("KOLVEX_ADMIN_ACCESS_TOKEN", ""))
        options = {}
        if args.transport == "streamable-http":
            options["transport_security"] = http_options(os.environ)
        server = create_server(KolvexClient(settings), **options)
        if args.transport == "stdio":
            server.run(transport="stdio")
        else:
            import uvicorn
            token = os.getenv("KOLVEX_MCP_AUTH_TOKEN", "")
            if token == settings.admin_token:
                raise ValueError("KOLVEX_MCP_AUTH_TOKEN must be distinct from the backend administrator token.")
            app = BearerAuth(server.streamable_http_app(), token)
            uvicorn.run(app, host=args.host, port=http_port(args.port, os.environ), access_log=False)
    except ValueError as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
