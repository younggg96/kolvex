export const PUBLIC_PAGE_SIZE = 20;
export const validReportId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export const validChannelId = (id: string) => !!id && id.length <= 128 && !/[\x00-\x20/\\?#]/.test(id);
export const validTicker = (ticker: string) => /^[A-Z0-9^][A-Z0-9.\-^=]{0,19}$/.test(ticker);
export const publicResearchPath = (id: string) => `/research/${encodeURIComponent(id)}`;
export const publicStockPath = (ticker: string) => `/stocks/${encodeURIComponent(ticker)}`;
export function publicPage(value?: string | string[]): number | null {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) return null;
  return Number(value);
}
export function publicPagePath(path: string, page: number) {
  return page === 1 ? path : `${path}?page=${page}`;
}
