import { chromium } from "playwright-core";
import { access, chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createConnection, createServer } from "node:net";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const profile = join(root, "state", "chrome-profile");
// Any of these only renders for a signed-in session; the account switcher hides on narrow windows.
export const signedIn = [
  '[data-testid="SideNav_AccountSwitcher_Button"]',
  '[data-testid="AppTabBar_Profile_Link"]',
  '[data-testid="SideNav_NewTweet_Button"]',
].join(", ");

// Explain a failure without printing page content, URLs with tokens, or stack traces.
export function describeFailure(error, mode) {
  const name = error?.name || "Error";
  const message = String(error?.message || "");
  if (mode === "login" && name === "TimeoutError") {
    return "15 分钟内没有检测到 X 登录。请重新运行 login，并在专用窗口里完成登录。";
  }
  if (/Target page, context or browser has been closed|Browser closed|has been closed/i.test(message)) {
    return "专用 Chrome 窗口被关闭了。请重新运行，并保持窗口打开直到脚本提示完成。";
  }
  if (/ProcessSingleton|SingletonLock|profile.*in use|user data directory is already in use/i.test(message)) {
    return "专用 Chrome 配置目录正被另一个 Chrome 进程使用。请关掉之前打开的采集窗口后重试。";
  }
  if (name === "BrowserDaemonUnavailable") {
    return "常驻连接进程没有运行：请执行 ./side-projects/x-posts/run.sh install --browser daily，并在 Chrome 弹窗里点允许。";
  }
  if (name === "DailyChromeUnavailable") {
    return "连不上日常 Chrome：请确认 Chrome 正在运行，并在 chrome://inspect/#remote-debugging 打开「允许远程调试」，弹出确认框时点允许。";
  }
  if (/Executable doesn't exist|Chromium distribution 'chrome' is not found/i.test(message)) {
    return "找不到 Google Chrome。请安装 Chrome 后重试。";
  }
  const firstLine = message.split("\n")[0].replace(/https?:\/\/\S+/g, "<url>").slice(0, 200);
  return `浏览器步骤失败（${name}: ${firstLine}）。已有文件已保留。`;
}

// Implement the collector's small tab interface using rendered DOM only.
export function browserTab(page) {
  const signature = () => page.locator("article time").evaluateAll(
    nodes => nodes.map(node => node.closest("a")?.getAttribute("href")).join("|")
  );
  return {
    playwright: page,
    url: async () => page.url(),
    goto: url => page.goto(url, { waitUntil: "domcontentloaded" }),
    getAXState: () => page.evaluate(() => {
      const visible = node => node.getClientRects().length > 0;
      const tabs = [...document.querySelectorAll('[role="tab"][aria-selected="true"]')]
        .filter(visible).map(node => "1 tab (selected) " + node.textContent.trim());
      const messages = [...document.querySelectorAll('h1,h2,[role="heading"],[role="alert"],button')]
        .filter(visible).map(node => "2 text " + node.textContent.trim());
      return [...tabs, ...messages].join("\n");
    }),
    async pressKey(_index, key) {
      const previous = await signature();
      await page.keyboard.press(key);
      await page.waitForFunction(before => {
        const current = [...document.querySelectorAll("article time")]
          .map(node => node.closest("a")?.getAttribute("href")).join("|");
        return current !== before;
      }, previous, { timeout: 5000 }).catch(error => {
        if (error.name !== "TimeoutError") throw error;
      });
    },
  };
}

export const DAILY = "daily";
// macOS limits Unix socket paths to 104 bytes, so keep this outside the long runtime path.
export const socketPath = process.env.KOLVEX_X_BROWSER_SOCKET
  || join(homedir(), "Library", "Application Support", "Kolvex", "x-browser.sock");
const chromePortFile = join(homedir(), "Library", "Application Support", "Google", "Chrome", "DevToolsActivePort");
const RECONNECT_CHECK_MS = 30000;
const RECONNECT_BACKOFF_MS = 15 * 60000;

const failure = (name, error) => Object.assign(new Error(error?.message || name), { name });
const log = message => console.log(`${new Date().toISOString()} ${message}`);

async function connectDaily(timeout = 60000) {
  try {
    // Reads DevToolsActivePort from Chrome's default user data directory. Chrome asks the user to allow it.
    return await chromium.connectOverCDP("chrome", { timeout });
  } catch (error) {
    throw failure("DailyChromeUnavailable", error);
  }
}

// One run's tabs. Closing never touches tabs the user opened, and never quits Chrome.
function trackedSession(context, onClose) {
  const opened = new Set();
  return {
    async newPage() {
      const page = await context.newPage();
      opened.add(page);
      return page;
    },
    async close() {
      for (const page of opened) await page.close().catch(() => {});
      opened.clear();
      await onClose?.();
    },
  };
}

async function openDedicated() {
  await mkdir(profile, { recursive: true, mode: 0o700 });
  await chmod(profile, 0o700);
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1280, height: 900 },
  });
  return { newPage: () => context.newPage(), close: () => context.close() };
}

async function writeSummaries(directory, reason) {
  const plan = JSON.parse(await readFile(join(directory, "plan.json"), "utf8"));
  for (const source of plan.sources) {
    await writeFile(join(directory, source.username + "-summary.json"), JSON.stringify({
      handle: source.username, new_posts: 0, complete: false, reason, missing: [],
    }));
  }
}

// Shared by one-shot runs and the daemon. Returns the collector exit code.
export async function collectRun(session, directory, { daily = false, signal } = {}) {
  const plan = JSON.parse(await readFile(join(directory, "plan.json"), "utf8"));
  const page = await session.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(45000);
  await page.goto("https://x.com/home", { waitUntil: "domcontentloaded" });
  const ready = await page.locator(signedIn).first()
    .waitFor({ state: "visible", timeout: 20000 }).then(() => true, () => false);
  await page.close().catch(() => {});
  if (!ready) {
    await writeSummaries(directory, "login_required");
    console.error(daily
      ? "日常 Chrome 中 X 未登录，请在日常 Chrome 里登录 X。"
      : "X 登录不可用，请运行 ./side-projects/x-posts/run.sh login。");
    return 2;
  }
  // Load the collector fresh for every run: the daily-Chrome daemon stays up for days and
  // must pick up an updated collect-in-cua.mjs without a restart.
  const { createXCollector } = await import(
    new URL("./collect-in-cua.mjs?run=" + Date.now(), import.meta.url).href
  );
  for (const source of plan.sources) {
    // Sources without a summary are reported as interrupted by the workflow.
    if (signal?.aborted) return 130;
    // A separate tab per source keeps a failed page from affecting other sources.
    const sourcePage = await session.newPage();
    sourcePage.setDefaultTimeout(10000);
    sourcePage.setDefaultNavigationTimeout(45000);
    try {
      const collector = await createXCollector(browserTab(sourcePage), root, directory);
      console.log(JSON.stringify(await collector.collect(source.username)));
    } catch {
      await writeFile(join(directory, source.username + "-summary.json"), JSON.stringify({
        handle: source.username, new_posts: 0, complete: false, reason: "browser_error", missing: [],
      }));
    } finally {
      await sourcePage.close().catch(() => {});
    }
  }
  return 0;
}

// Run directories must come from this collector's own incoming folder.
export function allowedRunDirectory(directory, base = join(root, "data", "incoming")) {
  if (typeof directory !== "string" || !isAbsolute(directory)) return false;
  const inside = relative(base, resolve(directory));
  return Boolean(inside) && !inside.startsWith("..") && !isAbsolute(inside);
}

// Line-delimited JSON over a user-only Unix socket: {"directory"} in, {"code"} out.
export async function serveCollections({ path = socketPath, run, base }) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await unlink(path).catch(() => {});
  let busy = false;
  const server = createServer(socket => {
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("data", async chunk => {
      buffer += chunk;
      const end = buffer.indexOf("\n");
      if (end < 0) return;
      socket.pause();
      const reply = value => socket.end(JSON.stringify(value) + "\n");
      let request;
      try {
        request = JSON.parse(buffer.slice(0, end));
      } catch {
        return reply({ code: 64, error: "bad_request" });
      }
      if (!allowedRunDirectory(request.directory, base)) return reply({ code: 64, error: "bad_directory" });
      if (busy) return reply({ code: 75, error: "busy" });
      busy = true;
      const controller = new AbortController();
      socket.on("close", () => controller.abort());
      try {
        reply({ code: await run(request.directory, controller.signal) });
      } catch (error) {
        console.error(describeFailure(error, "collect"));
        reply({ code: 1 });
      } finally {
        busy = false;
      }
    });
    socket.on("error", () => {});
  });
  await new Promise((done, fail) => server.once("error", fail).listen(path, done));
  await chmod(path, 0o600);
  return server;
}

export function requestCollect(directory, path = socketPath) {
  return new Promise((done, fail) => {
    const socket = createConnection(path);
    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("connect", () => socket.write(JSON.stringify({ directory }) + "\n"));
    socket.on("data", chunk => { buffer += chunk; });
    socket.on("end", () => {
      try {
        done(JSON.parse(buffer.trim()).code);
      } catch {
        fail(failure("BrowserDaemonUnavailable", new Error("no reply")));
      }
    });
    socket.on("error", error => fail(
      ["ENOENT", "ECONNREFUSED"].includes(error.code) ? failure("BrowserDaemonUnavailable", error) : error,
    ));
  });
}

// Holds one approved Chrome connection so scheduled runs need no new approval.
async function serve() {
  let browser = null;
  let connecting = null;
  let retryAfter = 0;
  const connect = () => {
    if (browser?.isConnected()) return Promise.resolve(browser);
    connecting ||= connectDaily().then(connected => {
      browser = connected;
      retryAfter = 0;
      log("已连接日常 Chrome。");
      connected.on("disconnected", () => {
        browser = null;
        log("与日常 Chrome 的连接已断开（Chrome 退出或关闭了远程调试），等待重新连接。");
      });
      return connected;
    }).catch(error => {
      // An unanswered approval prompt must not reappear every few seconds.
      retryAfter = Date.now() + RECONNECT_BACKOFF_MS;
      log("连接日常 Chrome 失败，15 分钟后再试。");
      throw error;
    }).finally(() => { connecting = null; });
    return connecting;
  };
  // Reconnect soon after Chrome restarts, while the user is likely at the screen to approve.
  const watcher = setInterval(async () => {
    if (browser?.isConnected() || connecting || Date.now() < retryAfter) return;
    if (await access(chromePortFile).then(() => true, () => false)) await connect().catch(() => {});
  }, RECONNECT_CHECK_MS);
  const server = await serveCollections({
    run: async (directory, signal) => {
      let connected;
      try {
        connected = await connect();
      } catch (error) {
        await writeSummaries(directory, "daily_chrome_unavailable");
        console.error(describeFailure(error, "collect"));
        return 2;
      }
      log("开始采集。");
      const session = trackedSession(connected.contexts()[0]);
      try {
        return await collectRun(session, directory, { daily: true, signal });
      } finally {
        await session.close();
        log("采集结束，已关闭本轮打开的标签页。");
      }
    },
  });
  log("常驻连接进程已启动。");
  await connect().catch(() => {});
  const stop = async () => {
    clearInterval(watcher);
    server.close();
    await unlink(socketPath).catch(() => {});
    // Disconnects only; Chrome keeps running.
    await browser?.close().catch(() => {});
    process.exit(0);
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}

async function main() {
  const [mode, runPath] = process.argv.slice(2);
  if (mode === "serve") return serve();
  if (!["login", "collect"].includes(mode) || (mode === "collect" && !runPath)) {
    throw new Error("Use browser.mjs login, browser.mjs serve or browser.mjs collect <run-directory>");
  }
  const daily = process.env.KOLVEX_X_BROWSER === DAILY;
  if (mode === "login" && daily) {
    console.log("日常 Chrome 模式不需要 login：请确认日常 Chrome 已登录 X，并在常驻连接进程首次连接时点允许。");
    return;
  }
  if (daily) {
    const directory = resolve(runPath);
    try {
      process.exitCode = await requestCollect(directory);
    } catch (error) {
      if (error.name !== "BrowserDaemonUnavailable") throw error;
      await writeSummaries(directory, "daily_chrome_unavailable");
      console.error(describeFailure(error, mode));
      process.exitCode = 2;
    }
    return;
  }
  const session = await openDedicated();
  let closing = false;
  const close = async () => {
    if (!closing) {
      closing = true;
      await session.close();
    }
  };
  const terminate = () => { void close().finally(() => process.exit(130)); };
  process.once("SIGTERM", terminate);
  process.once("SIGINT", terminate);
  try {
    if (mode === "login") {
      const page = await session.newPage();
      page.setDefaultNavigationTimeout(45000);
      await page.goto("https://x.com/home", { waitUntil: "domcontentloaded" });
      console.log("请在专用 Chrome 窗口登录 X。登录成功后将自动关闭窗口并开始首轮采集。");
      await page.locator(signedIn).first().waitFor({ state: "visible", timeout: 900000 });
      console.log("X 登录已确认。");
      return;
    }
    process.exitCode = await collectRun(session, resolve(runPath));
  } finally {
    await close();
    process.removeListener("SIGTERM", terminate);
    process.removeListener("SIGINT", terminate);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(describeFailure(error, process.argv[2]));
    process.exitCode = 1;
  });
}
