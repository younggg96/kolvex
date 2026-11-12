/* Import in CUA REPL. All browser access uses the supplied temporary tab. */
export async function createXCollector(tab, root, runDirectory) {
  const fs = await import("node:fs/promises");
  const incoming = root + "/data/incoming";
  const read = async (path, fallback = {}) => {
    try {
      return JSON.parse(await fs.readFile(path, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return fallback;
      throw error;
    }
  };
  const write = async (path, data) => {
    await fs.writeFile(path + ".tmp", JSON.stringify(data));
    await fs.rename(path + ".tmp", path);
  };
  const { sources } = await read(runDirectory + "/plan.json");
  const extractor = await fs.readFile(root + "/extract-posts.js", "utf8");
  const extract = handle => tab.playwright.evaluate("(" + extractor + ")(" + JSON.stringify(handle) + ")");
  const observe = () => tab.getAXState({ emit: false, disableDiffing: true });
  const blocked = state => /(?:^|\n)\s*\d+ (?:text|heading|button) (?:Rate limit exceeded|Something went wrong|Sign in to X|Verify your identity|Log in to X)(?:,|\s*$)/im.test(state);
  const navigate = async url => {
    if ((await tab.url())?.toLowerCase() !== url.toLowerCase()) await tab.goto(url);
  };

  async function detail(handle, id) {
    await navigate("https://x.com/" + handle + "/status/" + id);
    const time = tab.playwright.locator('a[href$="/status/' + id + '"] time,a[href$="/status/' + id + '/history"] time');
    const state = await observe();
    if (blocked(state)) throw new Error("page_blocked");
    await time.first().waitFor({ state: "attached", timeoutMs: 6000 });
    const article = tab.playwright.locator("article").filter({ has: time });
    const original = article.getByRole("button", { name: /^(Show original|显示原文)$/ }).first();
    const more = article.getByTestId("tweet-text-show-more-link").first();
    for (const control of [original, more]) {
      if (await control.isVisible()) {
        await control.click({ timeoutMs: 2200 });
        if (blocked(await observe())) throw new Error("page_blocked");
      }
    }
    return (await extract(handle)).posts.find(post => post.id === id && !post.truncated);
  }

  async function collect(handle) {
    const source = sources.find(item => item.username === handle);
    if (!source) throw new Error("Creator is missing from the run plan");
    const stops = new Set(source.stop_ids);
    const state = await read(root + "/state/" + handle + ".json");
    const seen = new Set(state.synced_post_ids || []);
    const workPath = incoming + "/" + handle + "-working.json";
    const working = stops.size ? {} : await read(workPath);
    if (!stops.size) await read(incoming + "/new-creators-progress.json");
    const order = new Map();
    const full = new Map((working.posts || []).filter(post => !post.truncated).map(post => [post.id, post]));
    const gaps = new Map();
    const capture = new Map();
    let reason = "limit";
    let boundary = null;
    let stale = 0;
    const prefix = runDirectory + "/" + handle;
    const saveCapture = () => write(prefix + "-capture.json", {
      boundary, reason, order: [...order], posts: [...capture.values()], rejected: [...gaps],
    });

    try {
      await navigate(source.url);
      await tab.playwright.locator('article a[href*="/' + handle + '/status/" i] time')
        .first().waitFor({ state: "attached", timeoutMs: 8000 }).catch(() => {});
      for (let scroll = 0; scroll <= source.max_scrolls; scroll++) {
        const ax = await observe();
        if (blocked(ax)) {
          reason = "page_blocked";
          break;
        }
        const result = await extract(handle);
        if (!result.ready || !result.order.length || !/tab \(selected[^\n]*\) Posts\b/.test(ax)) {
          reason = "page_unrecognized";
          break;
        }
        const count = order.size;
        const posts = new Map(result.posts.map(post => [post.id, post]));
        const rejected = new Map(result.rejected.map(post => [post.id, post.reason]));
        for (const [id, pinned] of result.order) {
          order.set(id, pinned);
          const post = posts.get(id);
          if (post && (!capture.has(id) || capture.get(id).truncated)) capture.set(id, post);
          if (post && !post.truncated) full.set(id, post);
          if (full.has(id)) gaps.delete(id);
          else gaps.set(id, rejected.get(id) || "truncated");
          if (!pinned && stops.has(id)) {
            boundary = id;
            reason = "checkpoint";
            break;
          }
          if (!stops.size && [...order.values()].filter(value => !value).length === 50) {
            reason = "initial_window";
            break;
          }
          if (order.size >= source.max_posts) break;
        }
        await saveCapture();
        if (reason !== "limit") break;
        if ([...gaps.values()].some(value => value.startsWith("Subscribers"))) {
          reason = "restricted_content";
          break;
        }
        stale = order.size === count ? stale + 1 : 0;
        if (stale >= 5 || order.size >= source.max_posts || scroll === source.max_scrolls) break;
        await tab.pressKey(null, "PageDown");
      }
    } catch {
      reason = "browser_error";
    }
    await saveCapture();

    const priorGaps = new Map((working.rejected || []).map(item => [item.id, item.reason]));
    const expected = new Set([...(working.expected_ids || []), ...gaps.keys()]);
    const saveWorking = () => write(workPath, {
      expected_ids: [...expected],
      posts: [...full.values()],
      rejected: [...expected].filter(id => !full.has(id))
        .map(id => ({ id, reason: gaps.get(id) || priorGaps.get(id) || "unresolved" })),
    });
    const recovered = new Set();
    const saveRecovery = () => write(prefix + "-recovered.json", [...recovered].map(id => full.get(id)));
    if (!["page_blocked", "page_unrecognized", "browser_error"].includes(reason)) {
      for (const id of expected) {
        const gap = gaps.get(id) || priorGaps.get(id) || "";
        if (full.has(id) || (seen.has(id) && id !== boundary) || gap.startsWith("Subscribers")) continue;
        if (gap.startsWith("No original") && priorGaps.get(id) === gap) continue;
        try {
          const post = await detail(handle, id);
          if (post) {
            full.set(id, { ...post, pinned: order.get(id) ?? post.pinned });
            recovered.add(id);
            await saveRecovery();
            if (!stops.size) await saveWorking();
          }
        } catch (error) {
          if (error.message === "page_blocked") {
            reason = "page_blocked";
            break;
          }
        }
      }
    }
    if (!stops.size) await saveWorking();
    const missing = [...new Set([...order.keys(), ...expected])]
      .filter(id => !full.has(id) && (!seen.has(id) || id === boundary))
      .map(id => ({ id, reason: gaps.get(id) || priorGaps.get(id) || "unresolved" }));
    const complete = missing.length === 0 && (
      (reason === "checkpoint" && full.has(boundary)) || reason === "initial_window"
    );
    const stopReason = !complete && ["checkpoint", "initial_window"].includes(reason) ? "missing_original" : reason;
    const eligible = new Set([...order.keys(), ...recovered]);
    const fresh = [...eligible].filter(id => full.has(id) && !seen.has(id));
    if (fresh.length) {
      const ids = new Set(fresh);
      if (complete && boundary) ids.add(boundary);
      if (complete && !stops.size) for (const id of order.keys()) ids.add(id);
      await write(prefix + "-export.json", {
        source: source.url,
        collected_at: new Date().toISOString(),
        collection_method: "Rendered public Posts timeline and detail expansion",
        scope: stops.size ? "Incremental public Posts" : "Initial public Posts window",
        scan_complete: complete,
        stop_reason: stopReason,
        posts: [...ids].map(id => full.get(id)),
      });
    }
    const summary = { handle, new_posts: fresh.length, complete, reason: stopReason, missing };
    await write(prefix + "-summary.json", summary);
    return summary;
  }
  return { sources, collect };
}
