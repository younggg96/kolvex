import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 允许代理的域名白名单
const ALLOWED_DOMAINS = [
  "pbs.twimg.com",
  "abs.twimg.com",
  "financialmodelingprep.com",
  "static.finnhub.io",
  "static2.finnhub.io",
  "logo.clearbit.com",
  "upload.wikimedia.org",
  "i.ytimg.com",
  "yt3.ggpht.com",
  "sns-img-qc.xhscdn.com",
  "sns-img-bd.xhscdn.com",
  "sns-img-hw.xhscdn.com",
  "sns-avatar-qc.xhscdn.com",
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");

    if (!url) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    // 解码 URL
    let decodedUrl: string;
    try {
      decodedUrl = decodeURIComponent(url);
    } catch {
      decodedUrl = url;
    }

    // 验证 URL 格式
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(decodedUrl);
    } catch {
      return new NextResponse("Invalid URL", { status: 400 });
    }

    // 检查域名是否在白名单中
    const isAllowed = ALLOWED_DOMAINS.some(
      (domain) =>
        parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      return new NextResponse("Domain not allowed", { status: 403 });
    }

    // 获取图片
    const response = await fetch(decodedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: parsedUrl.origin,
      },
      cache: "force-cache",
    });

    if (!response.ok) {
      return new NextResponse("Failed to fetch image", { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

