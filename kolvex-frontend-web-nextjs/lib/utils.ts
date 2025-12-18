import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * 需要通过代理访问的图片域名
 */
const PROXY_DOMAINS = [
  "pbs.twimg.com",
  "abs.twimg.com",
  "financialmodelingprep.com",
  "static.finnhub.io",
  "static2.finnhub.io",
];

/**
 * 将外部图片 URL 转换为代理 URL
 * 用于绕过 CORS 限制（如 Twitter 图片）
 */
export function proxyImageUrl(url: string | null | undefined): string {
  if (!url) return "";

  try {
    const parsedUrl = new URL(url);
    const needsProxy = PROXY_DOMAINS.some(
      (domain) =>
        parsedUrl.hostname === domain ||
        parsedUrl.hostname.endsWith(`.${domain}`)
    );

    if (needsProxy) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`;
    }

    return url;
  } catch {
    return url;
  }
}
