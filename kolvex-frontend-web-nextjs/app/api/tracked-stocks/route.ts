import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

// GET - 获取所有追踪的股票
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(
      `${API_BASE_URL}${API_PREFIX}/stocks/tracked`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || "Failed to fetch tracked stocks" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data.stocks || []);
  } catch (error) {
    console.error("Error fetching tracked stocks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tracked stocks" },
      { status: 500 }
    );
  }
}

// POST - 添加新的追踪股票
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { symbol, companyName, logo } = body;

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${API_BASE_URL}${API_PREFIX}/stocks/tracked`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          company_name: companyName,
          logo_url: logo,
          notify: true,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || "Failed to create tracked stock" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error creating tracked stock:", error);
    return NextResponse.json(
      { error: "Failed to create tracked stock" },
      { status: 500 }
    );
  }
}

// PATCH - 更新追踪股票
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const response = await fetch(
      `${API_BASE_URL}${API_PREFIX}/stocks/tracked/${id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || "Failed to update tracked stock" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating tracked stock:", error);
    return NextResponse.json(
      { error: "Failed to update tracked stock" },
      { status: 500 }
    );
  }
}

// DELETE - 删除追踪股票
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 支持 query param 或 body
    const searchParams = request.nextUrl.searchParams;
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {
        // ignore
      }
    }

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const response = await fetch(
      `${API_BASE_URL}${API_PREFIX}/stocks/tracked/${id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || "Failed to delete tracked stock" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tracked stock:", error);
    return NextResponse.json(
      { error: "Failed to delete tracked stock" },
      { status: 500 }
    );
  }
}
