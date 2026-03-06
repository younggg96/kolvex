import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("q");
  const targetLang = searchParams.get("tl") || "zh-CN";

  if (!text) {
    return NextResponse.json({ error: "Missing q parameter" }, { status: 400 });
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Translation service error" },
        { status: res.status }
      );
    }

    const data = await res.json();
    const translated = (data[0] as Array<[string]>)
      .map((item) => item[0])
      .join("");

    return NextResponse.json({ translated });
  } catch {
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    );
  }
}
