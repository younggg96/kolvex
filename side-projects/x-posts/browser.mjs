import { chromium } from "playwright-core";
import { mkdir, chmod, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createXCollector } from "./collect-in-cua.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const profile = join(root, "state", "chrome-profile");
const accountMenu = '[data-testid="SideNav_AccountSwitcher_Button"]';

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

async function main() {
  const [mode, runPath] = process.argv.slice(2);
  if (!["login", "collect"].includes(mode) || (mode === "collect" && !runPath)) {
    throw new Error("Use browser.mjs login or browser.mjs collect <run-directory>");
  }
  await mkdir(profile, { recursive: true, mode: 0o700 });
  await chmod(profile, 0o700);
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1280, height: 900 },
  });
  let closing = false;
  const close = async () => {
    if (!closing) {
      closing = true;
      await context.close();
    }
  };
  const terminate = () => { void close().finally(() => process.exit(130)); };
  process.once("SIGTERM", terminate);
  process.once("SIGINT", terminate);
  try {
    const page = context.pages()[0] || await context.newPage();
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(45000);
    await page.goto("https://x.com/home", { waitUntil: "domcontentloaded" });
    if (mode === "login") {
      console.log("请在专用 Chrome 窗口登录 X。登录成功后将自动关闭窗口并开始首轮采集。");
      await page.locator(accountMenu).waitFor({ state: "visible", timeout: 900000 });
      console.log("X 登录已确认。");
      return;
    }
    const directory = resolve(runPath);
    const plan = JSON.parse(await readFile(join(directory, "plan.json"), "utf8"));
    try {
      await page.locator(accountMenu).waitFor({ state: "visible", timeout: 20000 });
    } catch {
      for (const source of plan.sources) {
        await writeFile(join(directory, source.username + "-summary.json"), JSON.stringify({
          handle: source.username, new_posts: 0, complete: false, reason: "login_required", missing: [],
        }));
      }
      console.error("X 登录不可用，请运行 ./side-projects/x-posts/run.sh login。");
      process.exitCode = 2;
      return;
    }
    for (const source of plan.sources) {
      // A separate tab per source keeps a failed page from affecting other sources.
      const sourcePage = await context.newPage();
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
  } finally {
    await close();
    process.removeListener("SIGTERM", terminate);
    process.removeListener("SIGINT", terminate);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error("浏览器采集未完成。检查 Chrome、专用配置目录和依赖，已有文件已保留。");
    process.exitCode = 1;
  });
}
