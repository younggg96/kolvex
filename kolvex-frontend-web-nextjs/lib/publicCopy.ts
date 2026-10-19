import zh from "@/lib/i18n/locales/zh.json";

/** Stable Chinese copy for server-rendered public reading components. */
export function publicCopy(key: string, params?: Record<string, string>): string {
  let value: unknown = zh;
  for (const part of key.split(".")) value = value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined;
  const text = typeof value === "string" ? value : key;
  return Object.entries(params || {}).reduce((result, [name, replacement]) => result.replaceAll(`{${name}}`, replacement), text);
}
