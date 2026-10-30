# Kolvex deployment, 2026-10-30

Commit: `09de1f9ae6a784708fa053bcd853e0e7b5bfbb0e` on `main`.

The release was rebased on remote `586f663` before publishing, preserving the
latest watchlist, stock search, calendar, and X content changes.

## Verification

- Next.js production build passed after rebasing (51 static pages).
- Watchlist and stock discovery tests: 16 passed.
- MCP server tests: 14 passed.
- MCP real HTTP entrypoint test: 1 passed; local port binding required sandbox escalation.
- Production frontend deployment reported success through the Vercel GitHub integration.
- GitHub Production deployment: `7447847428`.
- Vercel deployment: `7e9rZH8rztUUmRraAhHCYEPjs6HZ`.
- `https://kolvex.app`: HTTP 200.
- Anonymous `/dashboard`: HTTP 307 to `/auth?redirectTo=%2Fdashboard` as expected.
- Existing backend `/health`: healthy; Redis is disconnected.
- Authenticated UI and Vercel runtime logs were not checked.

## MCP pending credentials

The Railway browser session was used because the connector repeatedly requested
authentication without completing its API calls.

- Project: Kolvex-backend (`b512dd22-7905-408a-9b03-f436cc8d53fc`).
- Environment: production (`669c3e0b-c220-4dd4-8b9f-009d799e3ecc`).
- Staged service: kolvex-mcp (`8bf4bcfe-3b04-48a0-824a-b001a78a0077`).
- Source: `younggg96/kolvex`, branch `main`.
- Root directory: `/kolvex-backend-py`.
- Builder: Dockerfile.
- Dockerfile path: `/kolvex-backend-py/Dockerfile.mcp`.
- Healthcheck: `/health`.
- KOLVEX_API_URL: existing HTTPS backend origin.

Service creation and settings remain in Railway's staged patch. They have not
been applied, built, or exposed publicly. KOLVEX_ADMIN_ACCESS_TOKEN and the
independent KOLVEX_MCP_AUTH_TOKEN must be supplied by the user in Railway.
No credentials were printed or committed. Once configured, apply the MCP-only
patch, inspect build/startup, configure networking, and verify health, rejection
of unauthenticated MCP requests, protocol initialization, 18 tools, and a read-only
backend call before calling the MCP deployment complete.

The current Railway UI says new services cannot opt into legacy Config as Code;
the staged service uses direct platform settings instead of railway.mcp.toml.
