import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Contact email delivery is disabled" },
    { status: 410 },
  );
}
