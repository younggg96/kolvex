import {
  BarChart3,
  PieChart,
  Telescope,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import type { ProductFeatureId } from "@/lib/productFeatures";
export interface MainNavItem {
  icon: LucideIcon;
  titleKey: string;
  shortTitleKey: string;
  href: string;
  type: "link";
  featureId: ProductFeatureId;
}
export const MAIN_NAV_ITEMS: MainNavItem[] = [
  {
    icon: BarChart3,
    titleKey: "sidebar.markets",
    shortTitleKey: "tabBar.markets",
    href: "/dashboard",
    type: "link",
    featureId: "home",
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
    icon: Telescope,
    titleKey: "sidebar.tradingAnalysis",
    shortTitleKey: "tabBar.tradingAnalysis",
    href: "/dashboard/ai-research",
    type: "link",
    featureId: "tradingAnalysis",
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
  if (href === "/dashboard") return pathname === href || pathname.startsWith("/dashboard/market/");
  if (href === "/dashboard/ai-research" &&
    (pathname === "/dashboard/trading-analysis" || pathname.startsWith("/dashboard/trading-analysis/"))) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
