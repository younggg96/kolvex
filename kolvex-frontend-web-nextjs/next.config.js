// next.config.js

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: false,
  swcMinify: true,
  disable:
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ENABLE_PWA !== "true",
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    domains: [
      // General
      "images.unsplash.com",
      "i.pravatar.cc",
      // Google (User Avatars)
      "lh3.googleusercontent.com",
      // Reddit
      "www.redditstatic.com",
      "i.redd.it",
      "external-preview.redd.it",
      "preview.redd.it",
      "a.thumbs.redditmedia.com",
      "b.thumbs.redditmedia.com",
      // YouTube
      "i.ytimg.com",
      "yt3.ggpht.com",
      "img.youtube.com",
      "ci.rednote.com",
      // Finnhub (Company Logos)
      "static.finnhub.io",
      "static2.finnhub.io",
      // Financial Modeling Prep (Company Logos)
      "financialmodelingprep.com",
      "images.financialmodelingprep.com",
      // Clearbit (Alternative Logo Source)
      "logo.clearbit.com",
      // Wikimedia Commons (S&P 500 Company Logos)
      "upload.wikimedia.org",
      // Supabase Storage
      "*.supabase.co",
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },

    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    // 仅作用于 Next/Image 响应头；保持严格无问题（不会影响页面加载 TradingView）
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // 优化图片缓存配置
    minimumCacheTTL: 31536000, // 1年（秒）
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  async headers() {
    // 开发环境：允许本地后端 API
    const isDevelopment = process.env.NODE_ENV === "development";
    const localApiUrl =
      process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";

    // 统一的 CSP（App/Pages Router 通用）
    // 如果不使用 Vercel Analytics，请把下面的 `va.vercel-scripts.com` 与 `*.vercel-insights.com` 从各指令删掉
    const ContentSecurityPolicy = `
      default-src 'self';
      base-uri 'self';
      object-src 'none';
      frame-ancestors 'self';
      ${!isDevelopment ? "upgrade-insecure-requests;" : ""}

      script-src
        'self'
        'unsafe-inline'
        'unsafe-eval'
        https://s3.tradingview.com
        https://*.tradingview.com
        https://va.vercel-scripts.com
        https://vercel.live
        https://*.vercel.live
        https://*.vercel-insights.com
        https://*.financialjuice.com
        https://feed.financialjuice.com
        https://cdn.plaid.com/link/v2/stable/link-initialize.js
      ;

      script-src-elem
        'self'
        'unsafe-inline'
        https://s3.tradingview.com
        https://*.tradingview.com
        https://va.vercel-scripts.com
        https://vercel.live
        https://*.vercel.live
        https://*.vercel-insights.com
        https://*.financialjuice.com
        https://feed.financialjuice.com
        https://cdn.plaid.com/link/v2/stable/link-initialize.js
      ;

      style-src
        'self'
        'unsafe-inline'
        https://*.tradingview.com
        https://*.financialjuice.com
        https://feed.financialjuice.com
      ;

      style-src-elem
        'self'
        'unsafe-inline'
        https://cdn.plaid.com
        https://*.plaid.com
      ;

      style-src-attr
        'unsafe-inline'
      ;

      img-src
        'self'
        data:
        blob:
        https:
      ;

      font-src
        'self'
        data:
        https:
      ;

      connect-src
        'self'
        https://*.tradingview.com
        https://*.supabase.co
        https://va.vercel-scripts.com
        https://vercel.live
        https://*.vercel.live
        wss://vercel.live
        wss://*.vercel.live
        https://*.vercel-insights.com
        https://*.financialjuice.com
        https://feed.financialjuice.com
        https://production.plaid.com
        https://sandbox.plaid.com
        https://development.plaid.com
        https://cdn.plaid.com
        https://*.up.railway.app
        ${isDevelopment ? localApiUrl : ""}
      ;

      frame-src
        'self'
        https://vercel.live
        https://*.vercel.live
        https://x.com
        https://twitter.com
        https://www.youtube.com
        https://embed.reddit.com
        https://*.tradingview.com
        https://*.financialjuice.com
        https://feed.financialjuice.com
        https://cdn.plaid.com
      ;

      worker-src
        'self'
        blob:
      ;
    `
      .replace(/\n/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    return [
      // 静态资源长缓存
      {
        source: "/:all*(svg|jpg|jpeg|png|gif|ico|webp|mp4|ttf|otf|woff|woff2)",
        locale: false,
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/image",
        locale: false,
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        locale: false,
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Authenticated app routes and API calls are real-time data surfaces.
      // Do not let browser/proxy caches or old service workers serve stale
      // portfolio sync state.
      {
        source: "/dashboard/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        ],
      },
      // 站点级 CSP
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: ContentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "0" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
