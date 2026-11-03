import { webURL } from "./config";
const GET_URL_SAFE_LIMIT = 1500;
// Translation lives in the Website's /api/translate route; there is no backend adapter.
export const translationAvailable = webURL.startsWith("https://");
export async function translateText(
  text: string,
  targetLang: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!text?.trim()) return text;
  if (!translationAvailable) throw new Error("翻译服务未配置。");
  const tl = targetLang === "zh" ? "zh-CN" : targetLang;
  const res =
    text.length > GET_URL_SAFE_LIMIT
      ? await fetch(`${webURL}/api/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: text, tl }),
          signal,
        })
      : await fetch(
          `${webURL}/api/translate?tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(text)}`,
          { signal },
        );
  if (!res.ok) throw new Error("翻译失败，请重试。");
  const data = await res.json();
  if (typeof data.translated !== "string" || !data.translated.trim())
    throw new Error("翻译失败，请重试。");
  return data.translated;
}
// Financial identifiers and source URLs stay literal in every target language.
const IDENTIFIER = /https?:\/\/[^\s]+|\$[A-Za-z][A-Za-z0-9.\-]{0,14}\b/g;
const OPEN = "⟨";
const CLOSE = "⟩";
const TAG = new RegExp(`${OPEN}(\\d+)${CLOSE}`, "g");
export function protectIdentifiers(text: string) {
  const literals: string[] = [];
  const masked = text.replace(IDENTIFIER, (value) => {
    literals.push(value);
    return `${OPEN}${literals.length - 1}${CLOSE}`;
  });
  return { masked, literals };
}
export function restoreIdentifiers(translated: string, literals: string[]) {
  const restored = translated
    .replace(TAG, (_, index: string) => literals[Number(index)] ?? "")
    .replace(new RegExp(`${OPEN}\\d*${CLOSE}?`, "g"), "");
  // Never let a cashtag silently vanish if the service dropped its placeholder.
  const dropped = literals.filter((literal) => !restored.includes(literal));
  return dropped.length
    ? `${restored.trimEnd()} ${dropped.join(" ")}`
    : restored;
}
export async function translateProtected(
  text: string,
  locale: string,
  signal?: AbortSignal,
) {
  const { masked, literals } = protectIdentifiers(text);
  return restoreIdentifiers(
    await translateText(masked, locale, signal),
    literals,
  );
}
