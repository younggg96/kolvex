import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { isShareId, sharePath } from "@/lib/contentShare";
import { PRIVATE_HEADERS, forwardShare, sessionToken, unauthorized } from "../forward";

export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
const invalid = () =>
  NextResponse.json({ error: "not_found" }, { status: 404, headers: PRIVATE_HEADERS });

/** Read with the viewer's session, so signed-in-only shares unlock. */
export async function GET(_request: Request, { params }: Context) {
  if (!isShareId(params.id)) return invalid();
  return forwardShare(`/${params.id}`, { method: "GET", token: await sessionToken() });
}

/** Stop sharing: the link stops working and the cached page is dropped. */
export async function DELETE(_request: Request, { params }: Context) {
  if (!isShareId(params.id)) return invalid();
  const token = await sessionToken();
  if (!token) return unauthorized();
  const response = await forwardShare(`/${params.id}`, { method: "DELETE", token });
  if (response.ok) {
    revalidateTag(`share:${params.id}`);
    revalidatePath(sharePath(params.id));
  }
  return response;
}
