import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const API = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:8080";
const kinds = new Set(["financials", "filings", "insiders", "revenue-outlook"]);

export async function GET(_request: Request, { params }: { params: { path: string[] } }) {
  const path = params.path;
  const institutions = path[0] === "institutions";
  const valid = institutions
    ? path.length === 1 || (/^[a-z_]{1,32}$/.test(path[1] ?? "") && (path.length === 2 || (path.length === 3 && path[2] === "summary")))
    : path.length === 2 && /^[A-Za-z0-9][A-Za-z0-9.\-]{0,11}$/.test(path[0]) && kinds.has(path[1]);
  if (!valid) return NextResponse.json({ error: "Invalid research request" }, { status: 400 });
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const response = await fetch(`${API}/api/v1/market/free-research/${path.map(encodeURIComponent).join("/")}`, {
      cache: "no-store", signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) return NextResponse.json({ error: "Free research data unavailable" }, { status: response.status === 404 ? 404 : 503, headers });
    const data = await response.json();
    const arrayKey = institutions ? (path.length === 1 ? "managers" : path.length === 3 ? "top" : "holdings") : ({ financials: "annual", filings: "filings", insiders: "transactions", "revenue-outlook": "estimates" } as Record<string, string>)[path[1]];
    if (!Array.isArray(data?.[arrayKey]) || (!institutions && data.symbol !== path[0].toUpperCase())) throw new Error("Invalid research response");
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json({ error: "Free research data unavailable" }, { status: 503, headers });
  }
}
