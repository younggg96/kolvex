import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { allowedRunDirectory, browserTab, describeFailure, requestCollect, serveCollections, signedIn } from "./browser.mjs";
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

test("login failures explain the cause without leaking URLs", () => {
  const timeout = Object.assign(new Error("locator.waitFor: Timeout 900000ms exceeded."), { name: "TimeoutError" });
  assert.match(describeFailure(timeout, "login"), /15 分钟/);
  assert.match(describeFailure(new Error("Target page, context or browser has been closed")), /窗口被关闭/);
  assert.match(describeFailure(Object.assign(new Error("x"), { name: "DailyChromeUnavailable" })), /remote-debugging/);
  assert.match(describeFailure(new Error("Failed to create a ProcessSingleton for your profile directory")), /另一个 Chrome/);
  const other = describeFailure(new TypeError("bad https://x.com/i/flow?token=abc\nstack"));
  assert.match(other, /TypeError/);
  assert.doesNotMatch(other, /token|stack/);
});

test("signed-in detection accepts the narrow-window profile link", async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<a data-testid="AppTabBar_Profile_Link" href="/me">Profile</a>');
    assert.equal(await page.locator(signedIn).first().isVisible(), true);
    await page.setContent('<a href="/i/flow/login">Sign in</a>');
    assert.equal(await page.locator(signedIn).count(), 0);
  } finally {
    await browser.close();
  }
});

test("daemon socket runs one collection at a time and rejects foreign directories", async () => {
  const base = await mkdtemp(join(tmpdir(), "kx-"));
  const path = join(base, "s.sock");
  const run = join(base, "run-1");
  let release;
  const seen = [];
  const server = await serveCollections({
    path,
    base,
    run: async (directory, signal) => {
      seen.push(directory);
      await new Promise(done => { release = done; });
      return signal.aborted ? 130 : 0;
    },
  });
  try {
    const first = requestCollect(run, path);
    await new Promise(done => setTimeout(done, 50));
    assert.equal(await requestCollect(join(base, "run-2"), path), 75);
    assert.equal(await requestCollect("/etc", path), 64);
    assert.equal(await requestCollect(join(base, "..", "x"), path), 64);
    release();
    assert.equal(await first, 0);
    assert.deepEqual(seen, [run]);
  } finally {
    server.close();
    await rm(base, { recursive: true, force: true });
  }
  await assert.rejects(requestCollect(run, path), { name: "BrowserDaemonUnavailable" });
  assert.equal(allowedRunDirectory("relative/dir", "/tmp"), false);
});

async function runCollector({ timeline, details = {}, synced = [] }) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const root = await mkdtemp(join(tmpdir(), "kolvex-x-gaps-"));
  try {
    const page = await browser.newPage();
    await page.route("**/*", route => {
      const id = route.request().url().match(/\/status\/(\d+)$/)?.[1];
      route.fulfill({ contentType: "text/html", body: id ? details[id] || "" : timeline });
    });
    await mkdir(join(root, "data/incoming"), { recursive: true });
    await mkdir(join(root, "state"), { recursive: true });
    if (synced.length) {
      await writeFile(join(root, "state/testuser.json"), JSON.stringify({ synced_post_ids: synced }));
    }
    await copyFile(new URL("./extract-posts.js", import.meta.url), join(root, "extract-posts.js"));
    await writeFile(join(root, "plan.json"), JSON.stringify({ sources: [
      { username: "testuser", url: "https://x.com/testuser", stop_ids: ["10"], max_posts: 50, max_scrolls: 2 },
    ] }));
    const collector = await createXCollector(browserTab(page), root, root);
    const summary = await collector.collect("testuser");
    const exported = await readFile(join(root, "testuser-export.json"), "utf8").then(JSON.parse, () => null);
    return { summary, exported };
  } finally {
    await browser.close();
    await rm(root, { recursive: true, force: true });
  }
}

const article = (id, inner) => `<article data-testid="tweet">
  <a href="/testuser/status/${id}"><time datetime="2026-11-${10 + Number(id) - 10}T12:00:00Z">t</time></a>${inner}</article>`;
const tabs = '<button role="tab" aria-selected="true">Posts</button>';
const checkpoint = article("10", '<div data-testid="tweetText">Previous checkpoint</div>');

test("subscriber-only posts are reported but no longer block the checkpoint", async () => {
  const { summary, exported } = await runCollector({ timeline: tabs
    + article("12", '<div data-testid="tweetText">New $NVDA</div>')
    + article("11", "<a>Subscribe to unlock</a>") + checkpoint });
  assert.equal(summary.complete, true);
  assert.equal(summary.reason, "checkpoint");
  assert.deepEqual(summary.missing, []);
  assert.deepEqual(summary.unavailable.map(item => item.id), ["11"]);
  assert.deepEqual(exported.posts.map(post => post.id).sort(), ["10", "12"]);
});

test("quote-only posts count as unavailable only after the detail page confirms it", async () => {
  const quoteOnly = article("11", '<div role="link"><div data-testid="tweetText">Someone else</div></div>');
  const confirmed = await runCollector({
    timeline: tabs + quoteOnly + checkpoint,
    details: { 11: tabs + quoteOnly },
  });
  assert.equal(confirmed.summary.complete, true);
  assert.deepEqual(confirmed.summary.unavailable.map(item => item.id), ["11"]);
  // Detail page never shows the post: still an unexplained gap, so the checkpoint stays.
  const unconfirmed = await runCollector({ timeline: tabs + quoteOnly + checkpoint, details: { 11: "<p>x</p>" } });
  assert.equal(unconfirmed.summary.complete, false);
  assert.deepEqual(unconfirmed.summary.missing.map(item => item.id), ["11"]);
});

test("a complete scan of already-imported posts still exports the new checkpoint", async () => {
  const { summary, exported } = await runCollector({
    timeline: tabs + article("11", '<div data-testid="tweetText">Old news</div>') + checkpoint,
    synced: ["11", "10"],
  });
  assert.equal(summary.complete, true);
  assert.equal(summary.new_posts, 0);
  assert.equal(exported.scan_complete, true);
  assert.deepEqual(exported.posts.map(post => post.id).sort(), ["10", "11"]);
});
