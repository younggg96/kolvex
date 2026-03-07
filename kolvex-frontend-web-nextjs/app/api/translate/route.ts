import { NextRequest, NextResponse } from "next/server";

const MAX_CHUNK_LENGTH = 4000;

async function translateChunk(
  text: string,
  targetLang: string
): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
    targetLang
  )}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { next: { revalidate: 86400 } });

  if (!res.ok) {
    throw new Error(`Translation service error: ${res.status}`);
  }

  const data = await res.json();
  return (data[0] as Array<[string]>).map((item) => item[0]).join("");
}

function splitIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    let splitIdx = remaining.lastIndexOf("\n\n", maxLen);
    if (splitIdx < maxLen * 0.3) {
      splitIdx = remaining.lastIndexOf("\n", maxLen);
    }
    if (splitIdx < maxLen * 0.3) {
      splitIdx = remaining.lastIndexOf(". ", maxLen);
      if (splitIdx > 0) splitIdx += 1;
    }
    if (splitIdx < maxLen * 0.3) {
      splitIdx = maxLen;
    }

    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }

  return chunks;
}

async function translateFull(
  text: string,
  targetLang: string
): Promise<string> {
  const chunks = splitIntoChunks(text, MAX_CHUNK_LENGTH);

  if (chunks.length === 1) {
    return translateChunk(chunks[0], targetLang);
  }

  const results = await Promise.all(
    chunks.map((chunk) => translateChunk(chunk, targetLang))
  );
  return results.join("\n\n");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("q");
  const targetLang = searchParams.get("tl") || "zh-CN";

  if (!text) {
    return NextResponse.json({ error: "Missing q parameter" }, { status: 400 });
  }

  try {
    const translated = await translateFull(text, targetLang);
    return NextResponse.json({ translated });
  } catch {
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text: string | undefined = body.q;
    const targetLang: string = body.tl || "zh-CN";

    if (!text) {
      return NextResponse.json(
        { error: "Missing q parameter" },
        { status: 400 }
      );
    }

    const translated = await translateFull(text, targetLang);
    return NextResponse.json({ translated });
  } catch {
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    );
  }
}
