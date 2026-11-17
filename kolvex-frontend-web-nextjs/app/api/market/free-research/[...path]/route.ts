import { NextResponse } from "next/server";
import { BACKEND_API_URL } from "@/lib/config/backend";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const kinds = new Set(["financials", "filings", "insiders", "revenue-outlook", "stock-returns"]);
const institutionKinds = new Set(["summary", "performance"]);

export async function GET(_request: Request, { params }: { params: { path: string[] } }) {
  const path = params.path;
  const institutions = path[0] === "institutions";
  const valid = institutions
    ? path.length === 1 ||
      (/^[a-z][a-z0-9_]{1,39}$/.test(path[1] ?? "") &&
        (path.length === 2 || (path.length === 3 && institutionKinds.has(path[2]))))
    : path.length === 2 && /^[A-Za-z0-9][A-Za-z0-9.\-]{0,11}$/.test(path[0]) && kinds.has(path[1]);
  if (!valid) return NextResponse.json({ error: "Invalid research request" }, { status: 400 });
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const response = await fetch(
      `${BACKEND_API_URL}/api/v1/market/free-research/${path.map(encodeURIComponent).join("/")}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(45000),
      },
    );
    if (!response.ok)
      return NextResponse.json(
        { error: "Free research data unavailable" },
        { status: response.status === 404 ? 404 : 503, headers },
      );
    const data = await response.json();
    const arrayKey = institutions
      ? path.length === 1
        ? "managers"
        : path.length === 3
          ? path[2] === "performance"
            ? "points"
            : "top"
          : "holdings"
      : (
          {
            financials: "annual",
            filings: "filings",
            insiders: "transactions",
            "revenue-outlook": "estimates",
            "stock-returns": "prices",
          } as Record<string, string>
        )[path[1]];
    if (
      !Array.isArray(data?.[arrayKey]) ||
      (!institutions && data.symbol !== path[0].toUpperCase()) ||
      (institutions && path[2] === "performance" && data.id !== path[1])
    )
      throw new Error("Invalid research response");
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json({ error: "Free research data unavailable" }, { status: 503, headers });
  }
}
