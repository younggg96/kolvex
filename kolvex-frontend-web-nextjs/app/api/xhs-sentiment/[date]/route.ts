import { BACKEND_API_V1 } from "@/lib/config/backend";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { date: string } }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const upstream = await fetch(`${BACKEND_API_V1}/xhs-sentiment/days/${params.date}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "text/plain",
        // Daily reports: share successful reads through the CDN for a few minutes.
        "Cache-Control": upstream.ok
          ? "public, s-maxage=300, stale-while-revalidate=900"
          : "no-store",
      },
    });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
