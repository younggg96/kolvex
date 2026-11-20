import type { ContentShare, ShareListItem, ShareTarget } from "./contentShare";

export class ShareRequestError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/shares${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ShareRequestError(data?.error || "unavailable", response.status);
  return data as T;
}

export function createShare(
  target: ShareTarget,
  locale: "zh" | "en",
  includeQuestion = true,
): Promise<ContentShare> {
  return request("", {
    method: "POST",
    body: JSON.stringify({
      kind: target.kind,
      source_id: target.sourceId,
      locale,
      excerpt: target.excerpt || "",
      include_question: includeQuestion,
    }),
  });
}

export const readShare = (id: string) => request<ContentShare>(`/${encodeURIComponent(id)}`);
export const revokeShare = (id: string) =>
  request<{ revoked: boolean }>(`/${encodeURIComponent(id)}`, { method: "DELETE" });
export const listShares = () => request<{ items: ShareListItem[] }>("");
