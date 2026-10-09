import {
  BarChart3,
  BookOpen,
  PieChart,
  ScanSearch,
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
    icon: ScanSearch,
    titleKey: "sidebar.research",
    shortTitleKey: "tabBar.research",
    href: "/dashboard/research",
    type: "link",
    featureId: "research",
  },
  {
    icon: Telescope,
    titleKey: "tradingAnalysis.title",
    shortTitleKey: "tabBar.tradingAnalysis",
    href: "/dashboard/trading-analysis",
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
  {
    icon: BookOpen,
    titleKey: "sidebar.journal",
    shortTitleKey: "tabBar.journal",
    href: "/dashboard/journal",
    type: "link",
    featureId: "journal",
  },
  {
    icon: Youtube,
    titleKey: "sidebar.youtubeOpinions",
    shortTitleKey: "tabBar.youtubeOpinions",
    href: "/dashboard/youtube-opinions",
    type: "link",
    featureId: "youtubeOpinions",
  },
];
export function isNavItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
