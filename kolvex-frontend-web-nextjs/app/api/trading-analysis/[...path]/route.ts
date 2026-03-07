/**
 * Trading Analysis API proxy route
 * Forwards authenticated requests to the backend Python API.
 * SSE streams are proxied with keepalive to prevent connection drops.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min max for SSE proxy

const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

function buildUrl(path: string[], searchParams: string): string {
  const pathString = path.join("/");
  return `${BACKEND_API_URL}/api/v1/trading-analysis/${pathString}${
    searchParams ? `?${searchParams}` : ""
  }`;
}

async function getAuthHeader(): Promise<string | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token
      ? `Bearer ${session.access_token}`
      : null;
  } catch {
    return null;
  }
}

function proxySSE(upstreamBody: ReadableStream<Uint8Array>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstreamBody.getReader();
      const KEEPALIVE_MS = 15_000;
      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

      const sendKeepalive = () => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          /* stream closed */
        }
      };

      keepaliveTimer = setInterval(sendKeepalive, KEEPALIVE_MS);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (err) {
        try {
          controller.error(err);
        } catch {
          /* already closed */
        }
      } finally {
        if (keepaliveTimer) clearInterval(keepaliveTimer);
        reader.releaseLock();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const authHeader = await getAuthHeader();
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path } = await params;
    const searchParams = request.nextUrl.searchParams.toString();
    const url = buildUrl(path, searchParams);

    const isStream = path[path.length - 1] === "stream";

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      let errorDetail = "API request failed";
      try {
        const parsed = JSON.parse(errorBody);
        errorDetail = parsed.detail || errorDetail;
      } catch {
        errorDetail = errorBody || errorDetail;
      }
      return NextResponse.json(
        { error: errorDetail },
        { status: response.status }
      );
    }

    if (isStream && response.body) {
      return proxySSE(response.body);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Trading Analysis API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const authHeader = await getAuthHeader();
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path } = await params;
    const searchParams = request.nextUrl.searchParams.toString();
    const url = buildUrl(path, searchParams);

    let body: string | undefined;
    try {
      const json = await request.json();
      body = JSON.stringify(json);
    } catch {
      // No body
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      let errorDetail = "API request failed";
      try {
        const parsed = JSON.parse(errorBody);
        errorDetail = parsed.detail || errorDetail;
      } catch {
        errorDetail = errorBody || errorDetail;
      }
      return NextResponse.json(
        { error: errorDetail },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Trading Analysis API POST error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const authHeader = await getAuthHeader();
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path } = await params;
    const url = buildUrl(path, "");

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      let errorDetail = "API request failed";
      try {
        const parsed = JSON.parse(errorBody);
        errorDetail = parsed.detail || errorDetail;
      } catch {
        errorDetail = errorBody || errorDetail;
      }
      return NextResponse.json(
        { error: errorDetail },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Trading Analysis API PATCH error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const authHeader = await getAuthHeader();
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path } = await params;
    const url = buildUrl(path, "");

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      let errorDetail = "API request failed";
      try {
        const parsed = JSON.parse(errorBody);
        errorDetail = parsed.detail || errorDetail;
      } catch {
        errorDetail = errorBody || errorDetail;
      }
      return NextResponse.json(
        { error: errorDetail },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Trading Analysis API DELETE error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
