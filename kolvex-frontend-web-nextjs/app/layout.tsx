import type { Metadata } from "next";
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION, publicPageMetadata } from "@/lib/seo";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { LanguageProvider } from "@/lib/i18n";
import { UserProfileProvider } from "@/components/user/UserProfileProvider";
import { StockDataCacheProvider } from "@/components/portfolio/hooks/useStockDataCache";
import NavigationProgress from "@/components/layout/NavigationProgress";
import SiteBackground from "@/components/layout/SiteBackground";
import { THEME_PALETTE_BOOT_SCRIPT } from "@/lib/themePalettes";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  ...publicPageMetadata(SITE_TITLE, SITE_DESCRIPTION, "/"),
  alternates: {},
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kolvex",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <script dangerouslySetInnerHTML={{ __html: THEME_PALETTE_BOOT_SCRIPT }} />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <SiteBackground />
          <LanguageProvider>
            <UserProfileProvider>
              <StockDataCacheProvider>
                {children}
                <Toaster />
              </StockDataCacheProvider>
            </UserProfileProvider>
          </LanguageProvider>
        </ThemeProvider>
        <NavigationProgress />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
