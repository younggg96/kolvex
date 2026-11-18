import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { browserTab } from "./browser.mjs";
import { createXCollector } from "./collect-in-cua.mjs";

test("Playwright adapter preserves original text and safe checkpoint evidence", async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const root = await mkdtemp(join(tmpdir(), "kolvex-x-browser-"));
  try {
    const page = await browser.newPage();
    const url = "https://x.com/testuser";
    await page.route("**/*", route => route.fulfill({ contentType: "text/html", body: `
      <button role="tab" aria-selected="true">Posts</button>
      <article data-testid="tweet">
        <a href="/testuser/status/11"><time datetime="2026-11-17T12:00:00Z">Today</time></a>
        <div data-testid="tweetText">Original $TSLA</div>
      </article>
      <article data-testid="tweet">
        <a href="/testuser/status/10"><time datetime="2026-11-16T12:00:00Z">Yesterday</time></a>
        <div data-testid="tweetText">Previous checkpoint</div>
      </article>` }));
    await mkdir(join(root, "data/incoming"), { recursive: true });
    await copyFile(new URL("./extract-posts.js", import.meta.url), join(root, "extract-posts.js"));
    await writeFile(join(root, "plan.json"), JSON.stringify({ sources: [
      { username: "testuser", url, stop_ids: ["10"], max_posts: 50, max_scrolls: 5 },
    ] }));
    const collector = await createXCollector(browserTab(page), root, root);
    const result = await collector.collect("testuser");
    assert.equal(result.complete, true);
    assert.equal(result.reason, "checkpoint");
    const exported = JSON.parse(await readFile(join(root, "testuser-export.json"), "utf8"));
    assert.equal(exported.posts[0].text, "Original $TSLA");
    assert.ok(exported.posts.some(post => post.id === "10"));
    await page.setContent('<h1>Rate limit exceeded</h1><button role="tab" aria-selected="true" hidden>Posts</button>');
    const state = await browserTab(page).getAXState();
    assert.match(state, /2 text Rate limit exceeded/);
    assert.doesNotMatch(state, /selected/);
  } finally {
    await browser.close();
    await rm(root, { recursive: true, force: true });
  }
});
