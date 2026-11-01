import assert from "node:assert/strict";
import { test } from "node:test";
import { credentialsError, safeExternal } from "../src/lib/links";
import {
  mentionChange,
  parseRedditStocks,
  selectRedditStocks,
} from "../src/lib/reddit";
import { localizedBrief, type DailyBrief } from "../src/lib/contentTypes";
process.env.EXPO_PUBLIC_API_URL = "https://backend.example.test/api/v1";
test("auth validation matches existing signup policy and accepts password-manager values", () => {
  assert.match(credentialsError("bad", "secret", false)!, /邮箱/);
  assert.match(credentialsError("user@example.test", "short", true)!, /6/);
  assert.equal(
    credentialsError(" user@example.test ", "six123", true),
    undefined,
  );
  assert.equal(
    credentialsError("user@example.test", "existing", false),
    undefined,
  );
});
test("external sources cannot execute scripts or carry embedded credentials", () => {
  assert.equal(safeExternal("javascript:alert(1)"), null);
  assert.equal(safeExternal("https://user:pass@example.test"), null);
  assert.equal(safeExternal("http://example.test"), null);
  assert.equal(
    safeExternal("https://youtube.com/watch?v=source"),
    "https://youtube.com/watch?v=source",
  );
});
test("mobile content uses public reader endpoints and bearer tokens only for private flows", async () => {
  const { configureIdentity } = await import("../src/lib/http");
  configureIdentity(async () => ({ token: "test", userId: "reader" }));
  const api = await import("../src/lib/contentApi");
  const calls: { path: string; token?: string }[] = [];
  globalThis.fetch = async (input, options) => {
    const path = new URL(String(input)).pathname;
    calls.push({
      path,
      token: (options?.headers as Record<string, string>).Authorization,
    });
    const payload = path.includes("/briefs")
      ? { items: [], total: 0 }
      : path.includes("trading-analysis")
        ? { items: [], total: 0 }
        : path.includes("x-content")
          ? { posts: [], total: 0 }
          : path.includes("news")
            ? { articles: [], fetched_at: "" }
            : { conversations: [], total: 0 };
    return new Response(JSON.stringify(payload));
  };
  const signal = new AbortController().signal;
  await api.briefs(signal, "reader", 1, "all");
  await api.reports(signal, "reader");
  await api.conversations("reader", signal, 1);
  await api.xPosts(signal, 0);
  await api.news(signal);
  assert.deepEqual(
    calls.map((row) => row.path),
    [
      "/api/v1/briefs",
      "/api/v1/trading-analysis/published/list",
      "/api/v1/chat/conversations",
      "/api/v1/x-content/posts",
      "/api/v1/news/feed",
    ],
  );
  assert.deepEqual(
    calls.map((row) => !!row.token),
    [true, true, true, false, false],
  );
});
test("Reddit missing baselines stay unavailable and rank growth sorts correctly", () => {
  const items = parseRedditStocks({
    results: [
      {
        ticker: "AAPL",
        name: "Apple",
        rank: "1",
        mentions: "20",
        upvotes: "10",
        rank_24h_ago: "3",
        mentions_24h_ago: "10",
      },
      {
        ticker: "NVDA",
        name: "Nvidia",
        rank: 2,
        mentions: 15,
        upvotes: 8,
        rank_24h_ago: null,
        mentions_24h_ago: 0,
      },
    ],
  });
  assert.equal(mentionChange(items[0]), 100);
  assert.equal(mentionChange(items[1]), null);
  assert.equal(
    selectRedditStocks(items, "$AAPL", "rankChange")[0].ticker,
    "AAPL",
  );
  assert.deepEqual(
    selectRedditStocks(items, "", "mentions", ["NVDA"]).map(
      (row) => row.ticker,
    ),
    ["NVDA"],
  );
});
test("briefs prefer uploaded Chinese translation without changing the saved envelope", () => {
  const source = {
    language: "en",
    brief: { title: "English", headline: "Headline" },
    sections: [],
    translations: { zh: { title: "中文日报", headline: "标题", sections: [] } },
  } as unknown as DailyBrief;
  const display = localizedBrief(source, "zh");
  assert.equal(display.brief.title, "中文日报");
  assert.equal(source.brief.title, "English");
});
