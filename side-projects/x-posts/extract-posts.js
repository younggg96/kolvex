/** Read rendered public posts only. No cookies, hidden app state or network calls. */
function extractXPosts(expectedUsername) {
  const expected = expectedUsername.replace(/^@/, "").toLowerCase();
  const posts = [];
  const rejected = [];
  const articles = [...document.querySelectorAll('article[data-testid="tweet"]')];
  // Server-rendered/loading variants do not expose the authored-text contract.
  // Report them explicitly; never treat an unrecognized DOM as an empty timeline.
  if (!articles.length) return { posts, rejected, ready: false, reason: "Wait for rendered tweet DOM; if it remains absent, inspect login and page structure" };
  for (const article of articles) {
    // Detail pages may place a quote's unlinked time before the post's own date.
    const time = [...article.querySelectorAll("time")].find(node =>
      /^\/[A-Za-z0-9_]+\/status\/\d+(?:\/history)?$/.test(node.closest("a")?.getAttribute("href") || "")
    ) || article.querySelector("time");
    const href = time?.closest("a")?.getAttribute("href");
    const match = href?.match(/^\/([A-Za-z0-9_]+)\/status\/(\d+)(?:\/history)?$/);
    if (!match || match[1].toLowerCase() !== expected) continue;
    if ([...article.querySelectorAll('a,button')].some(control => /^(Subscribe to unlock|订阅以解锁)$/.test(control.textContent?.trim() || ""))) {
      rejected.push({ id: match[2], reason: "Subscribers-only content; full original text unavailable" });
      continue;
    }
    if ([...article.querySelectorAll('button')].some(button => !button.closest?.('[role="link"]') && /^(Show original|显示原文)$/.test(button.textContent?.trim() || ""))) {
      rejected.push({ id: match[2], reason: "Translated content visible; select Show original before collecting" });
      continue;
    }
    const social = article.querySelector('[data-testid="socialContext"]')?.textContent || "";
    if (/reposted|retweeted|转帖|转发了/i.test(social)) continue;
    const texts = [...article.querySelectorAll('[data-testid="tweetText"]')];
    const own = texts.filter(el => !el.closest('[role="link"]'));
    const text = own.map(el => el.innerText).join("\n");
    if (!text.trim()) { rejected.push({ id: match[2], reason: "No original text; do not attribute quote-only text to author" }); continue; }
    const labels = [...article.querySelectorAll('[role="group"][aria-label]')].map(el => el.getAttribute("aria-label"));
    const label = labels.find(value => /repl|repost|like|bookmark|view/.test(value)) || "";
    const metrics = { replies: null, reposts: null, likes: null, bookmarks: null, views: null };
    for (const count of label.matchAll(/(?:^|,\s*)([\d,]+)\s+(repl(?:y|ies)|reposts?|likes?|bookmarks?|views?)\b/gi)) {
      const key = count[2].toLowerCase().startsWith("repl") ? "replies" : count[2].toLowerCase().replace(/s?$/, "s");
      metrics[key] = Number(count[1].replaceAll(",", ""));
    }
    const media = [...article.querySelectorAll('a[href]')].map(el => el.getAttribute("href"))
      .filter(value => /^\/[A-Za-z0-9_]+\/status\/\d+\/(photo|video)\/\d+$/.test(value));
    posts.push({ id: match[2], author_username: match[1], url: `https://x.com/${match[1]}/status/${match[2]}`,
      published_at: time.getAttribute("datetime"), text,
      cashtags: [...new Set([...text.matchAll(/\$([A-Za-z][A-Za-z0-9.\-]{0,14})\b/g)].map(value => value[1].toUpperCase()))],
      metrics, metrics_label: label, quoted_texts: texts.filter(el => !own.includes(el)).map(el => el.innerText),
      media_links: [...new Set(media)].map(value => `https://x.com${value}`),
      pinned: /pinned|置顶/i.test(social), truncated: Boolean(article.querySelector('[data-testid="tweet-text-show-more-link"]')),
    });
  }
  return { posts, rejected, ready: true };
}
