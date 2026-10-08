import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateThesis } from "@/lib/decision";

export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
const validId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function GET(_request: NextRequest, { params }: Context) {
  if (!validId(params.id))
    return NextResponse.json({ error: "Invalid thesis ID" }, { status: 400 });
  const db = await createServerSupabaseClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Sign in to view your journal" },
      { status: 401 },
    );
  const { data, error } = await db
    .from("investment_thesis_versions")
    .select("*")
    .eq("user_id", user.id)
    .eq("thesis_id", params.id)
    .order("version", { ascending: false })
    .limit(500);
  if (error)
    return NextResponse.json(
      { error: "Thesis history is unavailable" },
      { status: 503 },
    );
  if (!data?.length)
    return NextResponse.json({ error: "Thesis not found" }, { status: 404 });
  return NextResponse.json({ items: data });
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!validId(params.id))
    return NextResponse.json({ error: "Invalid thesis ID" }, { status: 400 });
  const db = await createServerSupabaseClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Sign in to update your thesis" },
      { status: 401 },
    );
  let draft, version: number;
  try {
    const body = await request.json();
    draft = validateThesis(body);
    version = body.version;
    if (!Number.isInteger(version) || version < 1)
      throw new Error("Invalid version");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid thesis" },
      { status: 400 },
    );
  }
  const { data: current, error: readError } = await db
    .from("investment_thesis_versions")
    .select("ticker,version")
    .eq("user_id", user.id)
    .eq("thesis_id", params.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError)
    return NextResponse.json(
      { error: "Thesis is unavailable" },
      { status: 503 },
    );
  if (!current)
    return NextResponse.json({ error: "Thesis not found" }, { status: 404 });
  if (current.version !== version)
    return NextResponse.json(
      { error: "Your thesis changed in another tab. Reload before saving." },
      { status: 409 },
    );
  if (current.ticker !== draft.ticker)
    return NextResponse.json(
      { error: "A thesis cannot change its ticker" },
      { status: 400 },
    );
  const { data, error } = await db
    .from("investment_thesis_versions")
    .insert({
      ...draft,
      user_id: user.id,
      thesis_id: params.id,
      version: version + 1,
    })
    .select()
    .single();
  if (error)
    return NextResponse.json(
      {
        error:
          error.code === "23505"
            ? "Your thesis changed in another tab. Reload before saving."
            : "Thesis could not be saved",
      },
      { status: error.code === "23505" ? 409 : 503 },
    );
  return NextResponse.json(data);
}
