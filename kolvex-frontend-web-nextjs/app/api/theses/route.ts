import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validTicker, validateThesis } from "@/lib/decision";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const db = await createServerSupabaseClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Sign in to view your journal" },
      { status: 401 },
    );
  const ticker = request.nextUrl.searchParams.get("ticker");
  if (ticker && !validTicker(ticker))
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  let query = db
    .from("investment_thesis_current")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (ticker) query = query.eq("ticker", ticker);
  const { data, error } = await query.limit(500);
  if (error)
    return NextResponse.json(
      {
        error:
          "Journal is unavailable. Please try again after the thesis database is configured.",
      },
      { status: 503 },
    );
  return NextResponse.json({ items: data });
}

export async function POST(request: NextRequest) {
  const db = await createServerSupabaseClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Sign in to save a thesis" },
      { status: 401 },
    );
  let draft;
  try {
    draft = validateThesis(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid thesis" },
      { status: 400 },
    );
  }
  const { data, error } = await db
    .from("investment_thesis_versions")
    .insert({
      ...draft,
      user_id: user.id,
      thesis_id: crypto.randomUUID(),
      version: 1,
    })
    .select()
    .single();
  if (error)
    return NextResponse.json(
      {
        error:
          "Thesis could not be saved. Please try again after the thesis database is configured.",
      },
      { status: 503 },
    );
  return NextResponse.json(data, { status: 201 });
}
