import {
  BarChart3,
  Star,
  PieChart,
  BookOpen,
  Landmark,
  ScrollText,
  Newspaper,
  Radio,
  Telescope,
  MessageSquareText,
  Activity,
  FolderKanban,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import { RedditIcon, XIcon, YouTubeIcon, type PlatformIconComponent } from "@/components/common/PlatformIcons";
import type { ProductFeatureId } from "@/lib/productFeatures";
export const SEARCH_HREF = "/dashboard/search";

/** Sidebar sections, in display order, grouped by what the user is trying to do. */
export const NAV_GROUPS = [
  { id: "track", titleKey: "sidebar.groups.track" },
  { id: "read", titleKey: "sidebar.groups.read" },
  { id: "research", titleKey: "sidebar.groups.research" },
  { id: "trade", titleKey: "sidebar.groups.trade" },
] as const;
export type NavGroupId = (typeof NAV_GROUPS)[number]["id"];

/** Footer destinations. There is no pricing or help centre yet, so both route to contact. */
export const HELP_HREF = "/contact";
export const UPGRADE_HREF = "/contact";

export interface MainNavItem {
  icon: LucideIcon;
  titleKey: string;
  shortTitleKey: string;
  href: string;
  type: "link";
  featureId: ProductFeatureId;
  group: NavGroupId;
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
    group: "track",
  },
  {
    icon: Star,
    titleKey: "sidebar.watchlist",
    shortTitleKey: "tabBar.watchlist",
    href: "/dashboard/watchlist",
    type: "link",
    featureId: "watchlist",
    group: "track",
  },
  {
    icon: Newspaper,
    titleKey: "sidebar.briefs",
    shortTitleKey: "tabBar.briefs",
    href: "/dashboard/briefs",
    type: "link",
    featureId: "briefs",
    group: "read",
  },
  {
    icon: Radio,
    titleKey: "sidebar.news",
    shortTitleKey: "tabBar.news",
    href: "/dashboard/news",
    type: "link",
    featureId: "news",
    group: "read",
  },
  {
    icon: MessageSquareText,
    children: OPINION_SOURCES,
    titleKey: "sidebar.youtubeOpinions",
    shortTitleKey: "tabBar.youtubeOpinions",
    href: "/dashboard/youtube-opinions",
    type: "link",
    featureId: "youtubeOpinions",
    group: "read",
  },
  {
    icon: MessagesSquare,
    titleKey: "sidebar.chat",
    shortTitleKey: "tabBar.chat",
    href: "/dashboard/chat",
    type: "link",
    featureId: "chat",
    group: "research",
  },
  {
    icon: FolderKanban,
    titleKey: "sidebar.workspaces",
    shortTitleKey: "tabBar.workspaces",
    href: "/dashboard/workspaces",
    type: "link",
    featureId: "chat",
    group: "research",
  },
  {
    icon: Telescope,
    titleKey: "sidebar.tradingAnalysis",
    shortTitleKey: "tabBar.tradingAnalysis",
    href: "/dashboard/ai-research",
    type: "link",
    featureId: "tradingAnalysis",
    group: "research",
  },
  {
    icon: Landmark,
    titleKey: "sidebar.superinvestors",
    shortTitleKey: "tabBar.superinvestors",
    href: "/dashboard/superinvestors",
    type: "link",
    featureId: "superinvestors",
    group: "research",
  },
  {
    icon: ScrollText,
    titleKey: "sidebar.congressTrades",
    shortTitleKey: "tabBar.congressTrades",
    href: "/dashboard/congress-trades",
    type: "link",
    featureId: "congressTrades",
    group: "research",
  },
  {
    icon: Activity,
    titleKey: "sidebar.optionsActivity",
    shortTitleKey: "tabBar.optionsActivity",
    href: "/dashboard/options-activity",
    type: "link",
    featureId: "optionsActivity",
    group: "research",
  },
  {
    icon: BookOpen,
    titleKey: "sidebar.paperTrading",
    shortTitleKey: "tabBar.paperTrading",
    href: "/dashboard/paper-trading",
    type: "link",
    featureId: "paperTrading",
    group: "trade",
  },
  {
    icon: PieChart,
    titleKey: "sidebar.portfolio",
    shortTitleKey: "tabBar.portfolio",
    href: "/dashboard/portfolio",
    type: "link",
    featureId: "portfolio",
    group: "trade",
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
