/** Read rendered public posts only. No cookies, hidden app state or network calls. */
function extractXPosts(expectedUsername) {
  const expected = expectedUsername.replace(/^@/, "").toLowerCase();
  const posts = [];
  const rejected = [];
  for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
    const time = article.querySelector("time");
    const href = time?.closest("a")?.getAttribute("href");
    const match = href?.match(/^\/([A-Za-z0-9_]+)\/status\/(\d+)$/);
    if (!match || match[1].toLowerCase() !== expected) continue;
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
    posts.push({ id: match[2], author_username: match[1], url: `https://x.com${href}`,
      published_at: time.getAttribute("datetime"), text,
      cashtags: [...new Set([...text.matchAll(/\$([A-Za-z][A-Za-z0-9.\-]{0,14})\b/g)].map(value => value[1].toUpperCase()))],
      metrics, metrics_label: label, quoted_texts: texts.filter(el => !own.includes(el)).map(el => el.innerText),
      media_links: [...new Set(media)].map(value => `https://x.com${value}`),
      pinned: /pinned|置顶/i.test(social), truncated: Boolean(article.querySelector('[data-testid="tweet-text-show-more-link"]')),
    });
  }
  return { posts, rejected };
}
