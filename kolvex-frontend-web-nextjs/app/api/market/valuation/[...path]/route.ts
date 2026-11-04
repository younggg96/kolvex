import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const API = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8080";
const headers = { "Cache-Control": "private, no-store" };

async function proxy(request: Request, path: string[]) {
  const job = path.length === 2 && path[0] === "jobs" && /^[a-f0-9]{32}$/.test(path[1]);
  const stock = path.length === 2 && /^[A-Za-z0-9][A-Za-z0-9.\-]{0,11}$/.test(path[0]) &&
    ["summary", "history", "simulate", "inputs", "calculate"].includes(path[1]);
  if ((!job && !stock) || (request.method === "POST") !== (stock && ["simulate", "calculate"].includes(path[1])))
    return NextResponse.json({ error: "Invalid valuation request" }, { status: 400, headers });
  const query = new URL(request.url).searchParams;
  const params = new URLSearchParams();
  if (query.has("years")) {
    const years = query.get("years")!;
    if (!/^[1-5]$/.test(years)) return NextResponse.json({ error: "Invalid history range" }, { status: 400, headers });
    params.set("years", years);
  }
  if (query.get("retry") === "true") params.set("retry", "true");
  try {
    const body = request.method === "POST" ? await request.text() : undefined;
    if (body && body.length > 8000) return NextResponse.json({ error: "Request too large" }, { status: 413, headers });
    const response = await fetch(`${API}/api/v1/valuation/${path.map(encodeURIComponent).join("/")}?${params}`, {
      method: request.method, body, headers: body ? { "Content-Type": "application/json" } : undefined,
      cache: "no-store", signal: AbortSignal.timeout(45000),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers });
  } catch {
    return NextResponse.json({ error: "Valuation data unavailable" }, { status: 503, headers });
  }
}

export const GET = (request: Request, { params }: { params: { path: string[] } }) => proxy(request, params.path);
export const POST = (request: Request, { params }: { params: { path: string[] } }) => proxy(request, params.path);
