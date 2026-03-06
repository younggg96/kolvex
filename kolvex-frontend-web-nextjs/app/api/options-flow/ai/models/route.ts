import { NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

/**
 * GET /api/options-flow/ai/models
 * Proxies to backend to list available Ollama models (no auth required for listing)
 */
export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/options-flow/ai/models`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      let detail = "Failed to fetch models";
      try {
        detail = JSON.parse(errorBody).detail || detail;
      } catch {
        detail = errorBody || detail;
      }
      return NextResponse.json({ error: detail }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Options AI models proxy error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
