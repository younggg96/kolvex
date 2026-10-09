export const DEEP_RESEARCH_PATH = "/dashboard/ai-research";
export const RESEARCH_AUTHORING_PATH = `${DEEP_RESEARCH_PATH}?view=authoring`;

export function parseDeepResearchPage(value: string | null | undefined) {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

export function deepResearchPagePath(page: number) {
  return page > 1 ? `${DEEP_RESEARCH_PATH}?page=${page}` : DEEP_RESEARCH_PATH;
}
