import { NextRequest } from "next/server";
import { forwardShare, sessionToken, unauthorized } from "./forward";

export const dynamic = "force-dynamic";

/** Create a share link. The body names the source; the backend builds the snapshot. */
export async function POST(request: NextRequest) {
  const token = await sessionToken();
  if (!token) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return forwardShare("", { method: "POST", body: "{}", token });
  const { kind, source_id, locale, excerpt, include_question } = body as Record<string, unknown>;
  return forwardShare("", {
    method: "POST",
    token,
    body: JSON.stringify({ kind, source_id, locale, excerpt, include_question }),
  });
}

/** The signed-in user's active share links. */
export async function GET() {
  const token = await sessionToken();
  if (!token) return unauthorized();
  return forwardShare("", { method: "GET", token });
}
