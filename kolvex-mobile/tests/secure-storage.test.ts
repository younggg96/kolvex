import assert from "node:assert/strict";
import { test } from "node:test";
import { createSessionStorage } from "../src/lib/secureStorage";
function memory() {
  const items = new Map<string, string>();
  let fail = false;
  return {
    items,
    breakWrites: () => {
      fail = true;
    },
    restore: () => {
      fail = false;
    },
    vault: {
      getItemAsync: async (key: string) => items.get(key) ?? null,
      setItemAsync: async (key: string, value: string) => {
        if (fail && key.endsWith(".1")) throw new Error("vault unavailable");
        items.set(key, value);
      },
      deleteItemAsync: async (key: string) => {
        items.delete(key);
      },
    },
  };
}
test("secure sessions round-trip long Unicode without splitting surrogate pairs", async () => {
  const store = memory();
  const adapter = createSessionStorage(store.vault);
  const session = JSON.stringify({
    refresh_token: "r".repeat(4000),
    user: { name: "中文😀".repeat(500) },
  });
  await adapter.setItem("auth-session", session);
  assert.equal(await adapter.getItem("auth-session"), session);
  for (const [key, value] of store.items)
    if (key !== "kolvex.auth-session")
      assert.ok(Buffer.byteLength(value, "utf8") <= 1600);
  await adapter.removeItem("auth-session");
  assert.equal(store.items.size, 0);
});
test("failed secure replacement preserves old session and removes partial chunks", async () => {
  const store = memory();
  const adapter = createSessionStorage(store.vault);
  await adapter.setItem("auth", "old-session");
  const previous = new Map(store.items);
  store.breakWrites();
  await assert.rejects(adapter.setItem("auth", "x".repeat(3000)));
  store.restore();
  assert.equal(await adapter.getItem("auth"), "old-session");
  assert.deepEqual(store.items, previous);
});
test("serialized writes cannot resurrect an old session after sign-out", async () => {
  const store = memory();
  const adapter = createSessionStorage(store.vault);
  await Promise.all([
    adapter.setItem("auth", "first"),
    adapter.setItem("auth", "second"),
    adapter.removeItem("auth"),
  ]);
  assert.equal(await adapter.getItem("auth"), null);
});
test("corrupt manifest is rejected but can be removed or replaced by fresh login", async () => {
  const store = memory();
  store.items.set("kolvex.auth", "invalid");
  const adapter = createSessionStorage(store.vault);
  await assert.rejects(adapter.getItem("auth"));
  await adapter.removeItem("auth");
  assert.equal(await adapter.getItem("auth"), null);
  store.items.set("kolvex.auth", "{}");
  await adapter.setItem("auth", "new");
  assert.equal(await adapter.getItem("auth"), "new");
});
