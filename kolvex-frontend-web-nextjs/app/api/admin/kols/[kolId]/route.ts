import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

async function getSessionToken() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token;
}

/**
 * GET /api/admin/kols/[kolId] - Get KOL detail
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kolId: string }> }
) {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { kolId } = await params;

    const response = await fetch(
      `${BACKEND_API_URL}/api/v1/admin/kols/${kolId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to fetch KOL" },
        { status: response.status }
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Admin KOL API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch KOL" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/kols/[kolId] - Update KOL
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ kolId: string }> }
) {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { kolId } = await params;
    const body = await request.json();

    const response = await fetch(
      `${BACKEND_API_URL}/api/v1/admin/kols/${kolId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to update KOL" },
        { status: response.status }
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Admin KOL API Error:", error);
    return NextResponse.json(
      { error: "Failed to update KOL" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/kols/[kolId] - Delete KOL
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ kolId: string }> }
) {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { kolId } = await params;
    const { searchParams } = new URL(request.url);
    const deletePosts = searchParams.get("delete_posts") === "true";

    const url = new URL(`${BACKEND_API_URL}/api/v1/admin/kols/${kolId}`);
    if (deletePosts) url.searchParams.set("delete_posts", "true");

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to delete KOL" },
        { status: response.status }
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Admin KOL API Error:", error);
    return NextResponse.json(
      { error: "Failed to delete KOL" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/kols/[kolId] - Toggle KOL active status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ kolId: string }> }
) {
  try {
    const token = await getSessionToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { kolId } = await params;
    const body = await request.json();
    const { is_active } = body;

    const url = new URL(
      `${BACKEND_API_URL}/api/v1/admin/kols/${kolId}/toggle-active`
    );
    url.searchParams.set("is_active", String(is_active));

    const response = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to toggle KOL status" },
        { status: response.status }
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Admin KOL API Error:", error);
    return NextResponse.json(
      { error: "Failed to toggle KOL status" },
      { status: 500 }
    );
  }
}
