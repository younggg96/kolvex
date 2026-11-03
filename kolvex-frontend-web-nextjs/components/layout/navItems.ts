import {
  BarChart3,
  Star,
  PieChart,
  Newspaper,
  Radio,
  Telescope,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";
import { RedditIcon, XIcon, YouTubeIcon, type PlatformIconComponent } from "@/components/common/PlatformIcons";
import type { ProductFeatureId } from "@/lib/productFeatures";
export const SEARCH_HREF = "/dashboard/search";

export interface MainNavItem {
  icon: LucideIcon;
  titleKey: string;
  shortTitleKey: string;
  href: string;
  type: "link";
  featureId: ProductFeatureId;
  children?: { title: string; href: string; icon: LucideIcon | PlatformIconComponent }[];
}
/** Each opinion source keeps the platform's own logo so the links stay distinct. */
export const OPINION_SOURCES = [
  { title: "YouTube", href: "/dashboard/youtube-opinions", icon: YouTubeIcon },
  { title: "Reddit", href: "/dashboard/reddit-opinions", icon: RedditIcon },
  { title: "X", href: "/dashboard/x-opinions", icon: XIcon },
];

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
    icon: Star,
    titleKey: "sidebar.watchlist",
    shortTitleKey: "tabBar.watchlist",
    href: "/dashboard/watchlist",
    type: "link",
    featureId: "watchlist",
  },
  {
    icon: Newspaper,
    titleKey: "sidebar.briefs",
    shortTitleKey: "tabBar.briefs",
    href: "/dashboard/briefs",
    type: "link",
    featureId: "briefs",
  },
  {
    icon: Radio,
    titleKey: "sidebar.news",
    shortTitleKey: "tabBar.news",
    href: "/dashboard/news",
    type: "link",
    featureId: "news",
  },
  {
    icon: MessageSquareText,
    children: OPINION_SOURCES,
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

export function isMainNavItemActive(pathname: string, item: MainNavItem) {
  return isNavItemActive(pathname, item.href) || Boolean(item.children?.some((child) => isNavItemActive(pathname, child.href)));
}
