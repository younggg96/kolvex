/**
 * The FastAPI backend that every Next.js route handler and server render proxies to.
 *
 * This is the only place that reads the backend URL environment variables; import from
 * here instead of repeating `process.env.… || "http://…"` in a route.
 *
 * - `BACKEND_API_URL` (server-only) wins when set, so a deployment can point server
 *   traffic at a private address.
 * - `NEXT_PUBLIC_BACKEND_API_URL` is the public address the browser also uses.
 * - The local fallback is `127.0.0.1`, not `localhost`: Node resolves `localhost` to
 *   IPv6 first, and uvicorn listens on IPv4 by default.
 */
const LOCAL_BACKEND_API_URL = "http://127.0.0.1:8080";

export const BACKEND_API_URL = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_API_URL ||
  LOCAL_BACKEND_API_URL
).replace(/\/+$/, "");

/** Base of the backend's versioned REST API (`/api/v1`). */
export const BACKEND_API_V1 = `${BACKEND_API_URL}/api/v1`;
