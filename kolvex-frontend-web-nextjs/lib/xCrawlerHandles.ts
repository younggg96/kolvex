// Turn admin-pasted X accounts into usernames the crawler accepts.

/** Profile URL or @handle → lowercase username; null if invalid. */
export function parseHandle(value: string): string | null {
  let text = value.trim();
  const url = text.match(/^https:\/\/(?:www\.)?x\.com\/([^/?#]+)\/?(?:[?#].*)?$/i);
  if (url) text = url[1];
  text = text.replace(/^@/, "");
  return /^[A-Za-z0-9_]{1,15}$/.test(text) ? text.toLowerCase() : null;
}

/** Split pasted text (newlines, spaces, commas) into unique usernames and the entries that are not valid. */
export function parseHandles(text: string): { usernames: string[]; invalid: string[] } {
  const usernames = new Set<string>();
  const invalid: string[] = [];
  for (const part of text.split(/[\s,，、;；]+/)) {
    if (!part) continue;
    const name = parseHandle(part);
    if (name) usernames.add(name);
    else invalid.push(part);
  }
  return { usernames: Array.from(usernames), invalid };
}
