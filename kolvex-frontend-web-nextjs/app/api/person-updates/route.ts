import { BACKEND_API_V1 } from "@/lib/config/backend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await fetch(`${BACKEND_API_V1}/person-updates`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "text/plain",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
