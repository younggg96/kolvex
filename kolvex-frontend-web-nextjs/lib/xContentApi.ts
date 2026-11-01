export interface XCreator {
  username: string;
  display_name: string;
  bio: string;
  avatar_url?: string | null;
  location?: string | null;
  website?: string | null;
  followers_count?: number | null;
  following_count?: number | null;
}
export interface XPost {
  id: string;
  author_username: string;
  url: string;
  published_at: string;
  text: string;
  cashtags: string[];
  metrics: Record<string, number | null>;
  quoted_texts: string[];
  media_links: string[];
  truncated: boolean;
  pinned: boolean;
  creator: XCreator | null;
}
export interface XFeed {
  posts: XPost[];
  total: number;
  limit: number;
  offset: number;
}
export interface XPreview {
  total: number;
  authors: string[];
  tickers: string[];
  truncated: number;
}
export async function xRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/x-content/${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    signal: options.signal ?? AbortSignal.timeout(35000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.error === "string" ? data.error : "X content request failed",
    );
  return data as T;
}
