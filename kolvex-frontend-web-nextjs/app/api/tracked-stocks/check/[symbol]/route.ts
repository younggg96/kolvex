import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

// GET - 检查股票是否已追踪
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const normalized = symbol.trim().toUpperCase();

    if (!normalized) {
      return NextResponse.json(
        { symbol: "", is_tracked: false, stock_id: null },
        { status: 200 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json(
        { symbol: normalized, is_tracked: false, stock_id: null },
        { status: 200 }
      );
    }

    const response = await fetch(
      `${API_BASE_URL}${API_PREFIX}/stocks/tracked/check/${encodeURIComponent(normalized)}`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { symbol: normalized, is_tracked: false, stock_id: null },
        { status: 200 }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      symbol: data.symbol?.toUpperCase?.() || normalized,
      is_tracked: Boolean(data.is_tracked),
      stock_id: data.stock_id ?? null,
    });
  } catch (error) {
    console.error("Error checking tracked stock:", error);
    const { symbol } = await params;
    return NextResponse.json(
      { symbol: symbol?.toUpperCase() || "", is_tracked: false, stock_id: null },
      { status: 200 }
    );
  }
}

