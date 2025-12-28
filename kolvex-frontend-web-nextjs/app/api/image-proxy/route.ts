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
  // 小红书图片 CDN (包含所有可能的子域名)
  "sns-webpic-qc.xhscdn.com",
  "sns-webpic-bd.xhscdn.com",
  "sns-webpic-hw.xhscdn.com",
  "sns-img-qc.xhscdn.com",
  "sns-img-bd.xhscdn.com",
  "sns-img-hw.xhscdn.com",
  "sns-avatar-qc.xhscdn.com",
  "ci.xiaohongshu.com",
  // 添加其他可能出现的 CDN 域名
  "sns-video-qc.xhscdn.com",
  "sns-video-bd.xhscdn.com",
  "sns-video-hw.xhscdn.com",
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");

    if (!url) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    // 1. 解码 URL
    let decodedUrl: string;
    try {
      decodedUrl = decodeURIComponent(url);
    } catch {
      decodedUrl = url;
    }

    // 2. 验证 URL 格式
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(decodedUrl);
    } catch {
      return new NextResponse("Invalid URL", { status: 400 });
    }

    // 3. 检查域名白名单
    const isAllowed = ALLOWED_DOMAINS.some(
      (domain) =>
        parsedUrl.hostname === domain ||
        parsedUrl.hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      console.warn(`Blocked attempt to proxy: ${parsedUrl.hostname}`);
      return new NextResponse("Domain not allowed", { status: 403 });
    }

    // 4. 判断是否是小红书域名 (用于特殊处理)
    const isXhsDomain =
      parsedUrl.hostname.includes("xhscdn.com") ||
      parsedUrl.hostname.includes("xiaohongshu.com");

    // 5. 构造伪装 Header
    // 小红书等平台检查非常严格，必须模拟真实浏览器的行为
    const fetchHeaders: HeadersInit = {
      // 核心：告诉服务器我们访问的是哪个主机
      Host: parsedUrl.host,

      // 模拟 Chrome 浏览器 User-Agent
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",

      // 接受各种图片格式
      Accept:
        "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",

      // 语言偏好
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",

      // Sec-Fetch 头：现代浏览器发出的请求都会带这些，缺少它们容易被识别为爬虫
      "Sec-Fetch-Dest": "image",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Site": "cross-site",

      // 缓存控制
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    };

    // 小红书特殊的 Referer 处理
    if (isXhsDomain) {
      // 经验证，小红书部分 CDN 节点如果检测到 Referer 为空或非官方域名会拦截
      fetchHeaders["Referer"] = "https://www.xiaohongshu.com/";
      fetchHeaders["Origin"] = "https://www.xiaohongshu.com";
    } else {
      // 其他网站一般使用源站作为 Referer
      fetchHeaders["Referer"] = parsedUrl.origin;
    }

    // 6. 发起请求
    const response = await fetch(decodedUrl, {
      headers: fetchHeaders,
      // 加上 cache: 'no-store' 避免 Vercel/Next.js 服务端缓存了之前的 403 错误响应
      cache: "no-store",
      // 某些 CDN 对重定向处理敏感，设为 follow
      redirect: "follow",
    });

    if (!response.ok) {
      console.error(
        `Proxy Fetch Error: ${response.status} ${response.statusText} for ${decodedUrl}`
      );
      // 如果源站返回 403，通常意味着签名过期或防盗链拦截
      if (response.status === 403 || response.status === 401) {
        return new NextResponse(
          "Source image access denied (Token expired or Hotlink protection)",
          { status: 403 }
        );
      }
      return new NextResponse("Failed to fetch image", {
        status: response.status,
      });
    }

    // 7. 处理返回的图片
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // 设置浏览器端缓存，减少重复请求
        "Cache-Control": "public, max-age=31536000, immutable",
        // 允许跨域，这样你的前端 Canvas 或其他组件可以操作此图片
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  } catch (error) {
    console.error("Image proxy internal error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

// 处理 OPTIONS 请求 (如果你的前端从不同域名调用此 API)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
