/** Shared public destinations for the landing menu and content links. */
export const landingNavigation = [
  {
    href: "/research",
    label: ["Stock research", "股票研究"],
    description: ["Explore the thesis, evidence and risks.", "结论、依据、风险，一起看。"],
  },
  {
    href: "/creators",
    label: ["Creator opinions", "博主观点"],
    description: ["Follow market views back to their sources.", "观点可追溯，原文可查看。"],
  },
  {
    href: "/stocks",
    label: ["Stock directory", "股票目录"],
    description: ["Find a stock and explore its research.", "查找关注的股票，查看相关研究。"],
  },
] as const;
