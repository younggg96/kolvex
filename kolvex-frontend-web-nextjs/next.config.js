// next.config.js

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
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
      // Twitter/X
      "pbs.twimg.com",
      "abs.twimg.com",
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
      // Rednote (小红书)
      "sns-img-qc.xhscdn.com",
      "sns-img-bd.xhscdn.com",
      "sns-img-hw.xhscdn.com",
      "ci.rednote.com",
      "sns-avatar-qc.xhscdn.com",
      // Finnhub (Company Logos)
      "static.finnhub.io",
      "static2.finnhub.io",
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
    // 统一的 CSP（App/Pages Router 通用）
    // 如果不使用 Vercel Analytics，请把下面的 `va.vercel-scripts.com` 与 `*.vercel-insights.com` 从各指令删掉
    const ContentSecurityPolicy = `
      default-src 'self';
      base-uri 'self';
      object-src 'none';
      frame-ancestors 'self';
      upgrade-insecure-requests;

      script-src
        'self'
        'unsafe-inline'
        'unsafe-eval'
        https://platform.twitter.com
        https://s3.tradingview.com
        https://*.tradingview.com
        https://va.vercel-scripts.com
        https://*.vercel-insights.com
      ;

      script-src-elem
        'self'
        'unsafe-inline'
        https://platform.twitter.com
        https://s3.tradingview.com
        https://*.tradingview.com
        https://va.vercel-scripts.com
        https://*.vercel-insights.com
      ;

      style-src
        'self'
        'unsafe-inline'
        https://platform.twitter.com
        https://*.tradingview.com
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
        https://platform.twitter.com
        https://va.vercel-scripts.com
        https://*.vercel-insights.com
      ;

      frame-src
        'self'
        https://platform.twitter.com
        https://x.com
        https://twitter.com
        https://www.youtube.com
        https://embed.reddit.com
        https://*.tradingview.com
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
