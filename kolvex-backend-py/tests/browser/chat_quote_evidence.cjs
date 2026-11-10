const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || "playwright-core");

const webUrl = process.env.QUOTE_TEST_WEB_URL;
const authUrl = process.env.QUOTE_TEST_AUTH_URL;
const conversationId = "00000000-0000-0000-0000-000000000002";
const user = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "quote-test@example.test",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: {},
};
const encode = (data) => Buffer.from(JSON.stringify(data)).toString("base64url");
const expiresAt = Math.floor(Date.now() / 1000) + 3600;
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
  sub: user.id,
  exp: expiresAt,
  role: "authenticated",
})}.fixture`;

async function run() {
  const browser = await chromium.launch({ channel: process.env.QUOTE_TEST_BROWSER || "chrome" });
  try {
    const context = await browser.newContext({ serviceWorkers: "block", locale: "en-US" });
    await context.addCookies([{
      name: `sb-${new URL(authUrl).hostname.split(".")[0]}-auth-token`,
      value: `base64-${encode({
        access_token: token, refresh_token: "fixture", expires_at: expiresAt, user,
      })}`,
      url: webUrl,
    }]);
    for (const url of [webUrl, authUrl]) {
      assert.equal(new URL(url).hostname, "127.0.0.1", "quote fixtures must run on loopback");
    }
    await context.route(/^https?:\/\/(?!127\.0\.0\.1:\d+\/)/, (route) => route.abort());

    const page = await context.newPage();
    page.on("pageerror", (error) => console.error("Browser error:", error.stack));
    page.on("requestfailed", (request) => {
      if (request.url().startsWith(webUrl)) console.error(request.url(), request.failure());
    });
    const chatUrl = `${webUrl}/dashboard/chat/${conversationId}`;
    await page.goto(chatUrl, { timeout: 120_000 });
    assert.equal(page.url(), chatUrl, "test session must reach the real chat page");

    page.setDefaultTimeout(30_000);
    const input = page.getByPlaceholder("Ask about a stock, a creator, or your holdings...");
    const cards = page.locator("figure").filter({ hasText: "Quote evidence" });
    const skillButton = page.getByRole("button", { name: "Skills", exact: true });
    const market = page.getByRole("checkbox", { name: "Market data", exact: true });
    const submit = async (question) => {
      await input.fill(question, { timeout: 45_000 });
      const [response] = await Promise.all([
        page.waitForResponse((response) =>
          response.request().method() === "POST" && response.url().endsWith("/stream")),
        page.getByRole("button", { name: "Send", exact: true }).click(),
      ]);
      assert.ok(response.ok(), `stream returned ${response.status()}`);
      const events = (await response.text()).split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => JSON.parse(line.slice(6)));
      assert.equal(events.at(-1)?.type, "done", JSON.stringify(events));
      return { request: response.request().postDataJSON(), events };
    };

    await submit("What is the NVDA quote?");
    await page.getByText("NVDA quote is 123.45 USD.", { exact: true }).first().waitFor();
    await cards.filter({ hasText: "NVDA" }).first().getByText("123.45", { exact: false }).waitFor();
    assert.match(await cards.first().locator("time").getAttribute("datetime"), /^2026-01-01/);
    assert.equal(await cards.first().getByRole("link").getAttribute("href"), "https://finance.yahoo.com/quote/NVDA/");
    console.log("PASS: quote answer matches card, with timestamp and source");

    await page.reload();
    await cards.filter({ hasText: "NVDA" }).getByText("123.45", { exact: false }).waitFor();
    assert.equal(await cards.count(), 1);
    console.log("PASS: reload restores the persisted quote snapshot");

    await skillButton.click();
    assert.equal(await market.isChecked(), true);
    await market.click();
    assert.equal(await market.isChecked(), false);
    await page.keyboard.press("Escape");
    const disabled = await submit("Verify the latest NVDA quote with my selected skills.");
    assert.equal(disabled.request.skills.includes("market"), false);
    assert.equal(disabled.events.some((event) => event.tool === "get_stock_quote"), false);
    await page.getByText("I could not verify the latest quote with the selected skills.", { exact: true }).first().waitFor();
    assert.equal(await cards.count(), 1);
    console.log("PASS: disabling market data prevents a new quote card");

    await skillButton.click();
    await market.click();
    await page.keyboard.press("Escape");
    await submit("What is the AMD quote?");
    const amdCard = cards.filter({ hasText: "AMD" }).first();
    await amdCard.getByText("Quote time unavailable", { exact: true }).waitFor();
    assert.equal(await amdCard.locator("time").count(), 0);
    await page.reload();
    await cards.filter({ hasText: "AMD" }).getByText("Quote time unavailable", { exact: true }).waitFor();
    console.log("PASS: missing quote time remains unknown after reload");

    const revenue = await submit("What is NVDA's reported quarterly revenue?");
    const evidence = revenue.events.at(-1).revenue_evidence;
    assert.deepEqual(evidence.map((row) => row.value), [200_000_000, 100_000_000]);
    await page.getByText("Revenue was 200,000,000 USD.", { exact: true }).first().waitFor();
    const revenueCards = page.locator("figure").filter({ hasText: "Revenue evidence" });
    await revenueCards.first().getByText("200,000,000 USD").waitFor();
    await page.reload();
    await revenueCards.nth(1).getByText("100,000,000 USD").waitFor();
    assert.equal(await revenueCards.count(), 2);
    assert.equal(await revenueCards.first().locator("time").getAttribute("datetime"), "2026-08-01");
    assert.match(await revenueCards.first().getByRole("link").getAttribute("href"), /^https:\/\/www.sec.gov\/Archives\//);
    console.log("PASS: directly reported revenue, periods and filing link survive reload");

    const missing = await submit("What is AMD's reported quarterly revenue?");
    assert.deepEqual(missing.events.at(-1).revenue_evidence, []);
    await page.getByText("No SEC revenue available.", { exact: true }).first().waitFor();
    assert.equal(await revenueCards.count(), 2);

    await skillButton.click();
    await page.getByRole("checkbox", { name: "Fundamentals", exact: true }).click();
    await page.keyboard.press("Escape");
    const withoutFundamentals = await submit("Check NVDA revenue with my selected skills.");
    assert.equal(withoutFundamentals.request.skills.includes("fundamentals"), false);
    assert.equal(withoutFundamentals.events.some((event) => event.tool === "get_reported_revenue"), false);
    assert.deepEqual(withoutFundamentals.events.at(-1).revenue_evidence, []);
    console.log("PASS: missing SEC facts and disabled fundamentals produce no revenue evidence");

    await page.setViewportSize({ width: 390, height: 740 });
    await input.blur();
    const thread = page.locator("[data-chat-floating-composer]");
    await thread.locator(".overflow-y-auto").first().dispatchEvent("wheel", { deltaY: -60 });
    await page.getByRole("button", { name: "Open message box" }).click();
    assert.equal(await input.evaluate((element) => document.activeElement === element), true);

    const setVisibleViewport = (height, offsetTop = 0) => page.evaluate(({ height, offsetTop }) => {
      const viewport = window.visualViewport;
      Object.defineProperties(viewport, {
        height: { configurable: true, value: height },
        offsetTop: { configurable: true, value: offsetTop },
      });
      viewport.dispatchEvent(new Event(offsetTop ? "scroll" : "resize"));
    }, { height, offsetTop });

    for (const offset of [0, 50]) {
      await setVisibleViewport(405, offset);
      const send = await page.getByRole("button", { name: "Send", exact: true }).boundingBox();
      assert.ok(send && send.y + send.height <= 405 + offset, "send button must clear the keyboard");
    }
    assert.equal(await page.locator("[data-mobile-dock]").isVisible(), false);
    await setVisibleViewport(740);
    assert.equal(await thread.getAttribute("data-chat-keyboard"), null);
    assert.equal(await page.locator("[data-mobile-dock]").isVisible(), true);
    console.log("PASS: expanded mobile composer clears the keyboard and restores the dock");
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
