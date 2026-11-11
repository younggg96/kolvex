// The Web's chat skills (components/chat/chatSkills.ts): research tools a conversation may use.
export const CHAT_SKILLS = [
  "market",
  "fundamentals",
  "options",
  "news",
  "creators",
  "portfolio",
] as const;
export type ChatSkill = (typeof CHAT_SKILLS)[number];
export const DEFAULT_CHAT_SKILLS: ChatSkill[] = CHAT_SKILLS.filter(
  (skill) => skill !== "portfolio",
);
export const SKILL_LABELS: Record<ChatSkill, string> = {
  market: "行情",
  fundamentals: "基本面",
  options: "期权",
  news: "新闻与网页",
  creators: "创作者观点",
  portfolio: "持仓分析",
};
export const SKILL_ICONS: Record<ChatSkill, [string, string]> = {
  market: ["chart.line.uptrend.xyaxis", "show_chart"],
  fundamentals: ["building.columns", "account_balance"],
  options: ["slider.horizontal.3", "tune"],
  news: ["newspaper", "newspaper"],
  creators: ["person.2", "group"],
  portfolio: ["briefcase", "work"],
};
/** Parses a skills route parameter; unknown names are dropped. */
export function parseSkills(value?: string): ChatSkill[] {
  if (typeof value !== "string") return [...DEFAULT_CHAT_SKILLS];
  const parts = value.split(",");
  return CHAT_SKILLS.filter((skill) => parts.includes(skill));
}
