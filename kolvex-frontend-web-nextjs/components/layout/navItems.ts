import {
  MessageCircle,
  PieChart,
  ScanSearch,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import type { ProductFeatureId } from "@/lib/productFeatures";

export interface MainNavItem {
  icon: LucideIcon;
  titleKey: string;
  shortTitleKey: string;
  href: string;
  type: "chat-submenu" | "link";
  featureId: ProductFeatureId;
}

export const MAIN_NAV_ITEMS: MainNavItem[] = [
  {
    icon: MessageCircle,
    titleKey: "sidebar.chat",
    shortTitleKey: "tabBar.chat",
    href: "/dashboard",
    type: "chat-submenu",
    featureId: "chat",
  },
  {
    icon: ScanSearch,
    titleKey: "sidebar.tradingAnalysis",
    shortTitleKey: "tabBar.tradingAnalysis",
    href: "/dashboard/trading-analysis",
    type: "link",
    featureId: "tradingAnalysis",
  },
  {
    icon: Youtube,
    titleKey: "sidebar.youtubeOpinions",
    shortTitleKey: "tabBar.youtubeOpinions",
    href: "/dashboard/youtube-opinions",
    type: "link",
    featureId: "youtubeOpinions",
  },
  {
    icon: PieChart,
    titleKey: "sidebar.portfolio",
    shortTitleKey: "tabBar.portfolio",
    href: "/dashboard/portfolio",
    type: "link",
    featureId: "portfolio",
  },
];

export function isNavItemActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/chat");
  }
  return pathname.startsWith(href);
}
