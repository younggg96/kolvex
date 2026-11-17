import {
  BarChart3,
  Briefcase,
  CalendarClock,
  Flame,
  Globe2,
  Landmark,
  Microscope,
  NotebookPen,
  Scale,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ChatAgent } from "@/lib/researchWorkspaceApi";

type Copy = (en: string, zh: string) => string;

/** The chat sub-agents as workspace panels: name and what each one answers. */
export const CHAT_AGENT_META: Record<
  ChatAgent,
  { icon: LucideIcon; en: string; zh: string; aboutEn: string; aboutZh: string }
> = {
  financial: {
    icon: BarChart3,
    en: "Quotes & financials",
    zh: "行情与财务",
    aboutEn: "Prices, financial figures and quick lookups.",
    aboutZh: "股价、财务数字和快速查询。",
  },
  valuation: {
    icon: Scale,
    en: "Valuation",
    zh: "估值",
    aboutEn: "Current PE against the company's own five-year range.",
    aboutZh: "当前市盈率在公司自己五年区间里的位置。",
  },
  earnings: {
    icon: CalendarClock,
    en: "Earnings",
    zh: "财报",
    aboutEn: "Earnings dates, reported results and what creators said around them.",
    aboutZh: "财报日期、已公布业绩，以及前后博主的观点。",
  },
  smart_money: {
    icon: Landmark,
    en: "Smart money",
    zh: "资金动向",
    aboutEn: "13F holdings, congressional trades and unusual options activity, each dated.",
    aboutZh: "13F 持仓、国会议员交易和期权异动，都带日期。",
  },
  creators: {
    icon: Users,
    en: "Creators",
    zh: "博主观点",
    aboutEn: "What tracked creators said, with links to the original videos and posts.",
    aboutZh: "跟踪的博主说了什么，附原视频 / 原帖链接。",
  },
  buzz: {
    icon: Flame,
    en: "Market buzz",
    zh: "市场热度",
    aboutEn: "Today's movers, volume spikes, Reddit and X mention counts.",
    aboutZh: "今日异动、放量、Reddit 和 X 的提及量。",
  },
  macro: {
    icon: Globe2,
    en: "Macro",
    zh: "宏观",
    aboutEn: "Fed, rates, inflation, jobs and the economic calendar.",
    aboutZh: "美联储、利率、通胀、就业和经济日历。",
  },
  portfolio: {
    icon: Briefcase,
    en: "My portfolio",
    zh: "我的持仓",
    aboutEn: "Your holdings and watchlist. Needs sign-in.",
    aboutZh: "你的持仓和自选股，需要登录。",
  },
  paper_review: {
    icon: NotebookPen,
    en: "Paper trading review",
    zh: "模拟交易复盘",
    aboutEn: "Reviews your virtual paper-trading account. Read-only.",
    aboutZh: "复盘你的模拟交易账户（虚拟资金，只读）。",
  },
  research: {
    icon: Microscope,
    en: "Deep research",
    zh: "深度研究",
    aboutEn: "A longer report that weighs several angles at once.",
    aboutZh: "综合多个角度写一份较长的研究。",
  },
};

export function chatAgentName(agent: ChatAgent, c: Copy) {
  const meta = CHAT_AGENT_META[agent];
  return c(meta.en, meta.zh);
}

export function chatAgentAbout(agent: ChatAgent, c: Copy) {
  const meta = CHAT_AGENT_META[agent];
  return c(meta.aboutEn, meta.aboutZh);
}
