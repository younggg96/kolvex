import { NextRequest, NextResponse } from "next/server";

const MAX_ENCODED_CHUNK_LENGTH = 6000;
const CACHE_LIMIT = 256;
const CACHE_TTL_MS = 60 * 60 * 1000;
const PRIMARY_ORIGIN = "https://translate.googleapis.com";
const SECONDARY_ORIGIN = "https://translate.google.com";
const cachedChunks = new Map<string, { translated: string; expires: number }>();
const pendingChunks = new Map<string, Promise<string>>();

async function fetchTranslation(text: string, targetLang: string): Promise<string> {
  const path = `/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
    targetLang,
  )}&dt=t&q=${encodeURIComponent(text)}`;
  let primaryRateLimited = false;
  for (const [attempt, origin] of [PRIMARY_ORIGIN, SECONDARY_ORIGIN, PRIMARY_ORIGIN].entries()) {
    if (attempt === 2) {
      if (primaryRateLimited) break;
      await new Promise((resolve) => setTimeout(resolve, 250 + Math.random() * 250));
    }
    let status: number | undefined;
    try {
      const res = await fetch(`${origin}${path}`, {
        // Cache only the validated result, never an invalid HTTP 200 from upstream.
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      status = res.status;
      if (attempt === 0) primaryRateLimited = status === 429;
      if (!res.ok) throw new Error("Upstream status");
      const data = await res.json();
      if (!Array.isArray(data?.[0])) throw new Error("Invalid translation response");
      const translated = data[0]
        .map((item: unknown) => (Array.isArray(item) && typeof item[0] === "string" ? item[0] : ""))
        .join("");
      if (!translated.trim()) throw new Error("Empty translation response");
      return translated;
    } catch {
      console.warn("[translation] Upstream attempt failed", { origin, status });
    }
  }
  throw new Error("Translation unavailable");
}

function translateChunk(text: string, targetLang: string): Promise<string> {
  const key = JSON.stringify([targetLang, text]);
  const cached = cachedChunks.get(key);
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.translated);
  cachedChunks.delete(key);
  const pending = pendingChunks.get(key);
  if (pending) return pending;

  const request = fetchTranslation(text, targetLang)
    .then((translated) => {
      if (cachedChunks.size >= CACHE_LIMIT) {
        const oldest = cachedChunks.keys().next();
        if (!oldest.done) cachedChunks.delete(oldest.value);
      }
      cachedChunks.set(key, { translated, expires: Date.now() + CACHE_TTL_MS });
      return translated;
    })
    .finally(() => pendingChunks.delete(key));
  pendingChunks.set(key, request);
  return request;
}

function splitIntoChunks(text: string): string[] {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start;
    let size = 0;
    let boundary = start;
    for (const char of text.slice(start)) {
      const length = encodeURIComponent(char).length;
      if (size + length > MAX_ENCODED_CHUNK_LENGTH) break;
      size += length;
      end += char.length;
      if (/\s/.test(char) && size >= MAX_ENCODED_CHUNK_LENGTH / 2) boundary = end;
    }
    if (end < text.length && boundary > start) end = boundary;
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

async function translateFull(text: string, targetLang: string): Promise<string> {
  const chunks = splitIntoChunks(text);
  const translated = await Promise.all(
    chunks.map(async (chunk) => {
      const source = chunk.trim();
      if (!source) return chunk;
      const start = chunk.indexOf(source);
      const result = await translateChunk(source, targetLang);
      return chunk.slice(0, start) + result.trim() + chunk.slice(start + source.length);
    }),
  );
  return translated.join("");
}

async function translate(text: unknown, targetLang: unknown) {
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Missing q parameter" }, { status: 400 });
  }
  if (typeof targetLang !== "string" || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(targetLang)) {
    return NextResponse.json({ error: "Invalid tl parameter" }, { status: 400 });
  }
  try {
    return NextResponse.json({ translated: await translateFull(text, targetLang) });
  } catch {
    return NextResponse.json({ error: "Translation failed" }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return translate(searchParams.get("q"), searchParams.get("tl") || "zh-CN");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return translate(body?.q, body?.tl || "zh-CN");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
