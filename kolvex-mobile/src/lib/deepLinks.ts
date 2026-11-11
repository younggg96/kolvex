// Website URLs and Kolvex links resolve to the native screen for the same content.
const encoded = encodeURIComponent;
const SYMBOL = /^[A-Za-z0-9^][A-Za-z0-9.^=\-]{0,19}$/;
export function nativePathFor(input: string): string {
  let url: URL;
  try {
    url = new URL(input, "https://kolvex.app");
  } catch {
    return "/";
  }
  if (url.protocol === "kolvex:") {
    // kolvex://stock/AAPL parses "stock" as the host.
    url = new URL(
      `/${url.host}${url.pathname}${url.search}`.replace(/\/+$/, "") || "/",
      "https://kolvex.app",
    );
  }
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [a, b, c, d] = parts;
  const query = url.searchParams;
  const stock = (symbol: string) => {
    if (!SYMBOL.test(symbol)) return "/";
    const tab = query.get("tab");
    const peers = query.get("peers");
    const rest = [
      tab ? `tab=${encoded(tab)}` : "",
      peers ? `peers=${encoded(peers)}` : "",
    ]
      .filter(Boolean)
      .join("&");
    return `/stock/${encoded(symbol.toUpperCase())}${rest ? `?${rest}` : ""}`;
  };
  if (!a) return "/";
  if (a === "auth") {
    if (b === "callback") return `/auth/callback${url.search}${url.hash}`;
    if (b === "reset-password" || b === "recovery")
      return `/auth/recovery${url.search}${url.hash}`;
    return "/account";
  }
  if (a === "share" && b === "creators" && c)
    return `/creator/youtube/${encoded(c)}`;
  if (a === "creators") return "/creators";
  if (a === "stocks") return b ? stock(b) : "/markets";
  if (a === "research") return b ? `/report/${encoded(b)}` : "/research";
  if (a !== "dashboard") {
    // Paths already in the native scheme.
    if (a === "stock" && b) return stock(b);
    return url.pathname + url.search;
  }
  switch (b) {
    case undefined:
      return "/";
    case "market":
      return c ? stock(c) : "/";
    case "research":
      if (c === "deep-research") return "/research";
      return c ? stock(c) : "/opinions";
    case "watchlist":
      return "/watchlist";
    case "news":
      return "/news";
    case "journal":
      return "/updates";
    case "settings":
      return "/preferences";
    case "admin":
      return "/admin";
    case "paper-trading":
      return `/paper-trading${url.search}`;
    case "options-activity":
      return `/options-activity${url.search}`;
    case "workspaces":
      return c ? `/workspace/${encoded(c)}` : "/workspaces";
    case "congress-trades":
      return `/congress-trades${url.search}`;
    case "superinvestors":
      return c ? `/superinvestor/${encoded(c)}` : "/superinvestors";
    case "briefs":
      return c ? `/brief/${encoded(c)}` : "/briefs";
    case "chat":
      return c ? `/chat/${encoded(c)}` : "/chat";
    case "ai-research":
      // The report management page is gone; every view opens AI research.
      return "/research";
    case "trading-analysis":
      if (c === "explore") return d ? `/report/${encoded(d)}` : "/research";
      return c ? `/research-task/${encoded(c)}` : "/research";
    case "youtube-opinions": {
      const creator = query.get("creator");
      if (creator) return `/creator/youtube/${encoded(creator)}`;
      return c === "stocks" || query.get("tab") === "creators"
        ? "/creators"
        : "/opinions";
    }
    case "x-opinions":
    case "reddit-opinions":
      return "/opinions";
    default:
      // Includes the disabled portfolio feature, matching the Web's redirect.
      return "/";
  }
}
