type Vault = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};
type Manifest = { generation: string; count: number };
function manifest(raw: string | null): Manifest | null {
  if (!raw) return null;
  const result = JSON.parse(raw) as Manifest;
  if (
    !/^[a-z0-9-]+$/.test(result.generation) ||
    !Number.isInteger(result.count) ||
    result.count < 1 ||
    result.count > 1000
  )
    throw new Error("会话存储格式无效。");
  return result;
}
// Commit the manifest only after every encrypted chunk is durable. A failed
// replacement cannot expose a partially written session or erase the old one.
export function createSessionStorage(vault: Vault) {
  let queue: Promise<unknown> = Promise.resolve();
  let serial = 0;
  function exclusive<T>(action: () => Promise<T>) {
    const result = queue.then(action);
    queue = result.catch(() => {});
    return result;
  }
  const root = (key: string) =>
    `kolvex.${key.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
  const clear = async (base: string, record: Manifest | null) => {
    if (record)
      await Promise.all(
        Array.from({ length: record.count }, (_, i) =>
          vault.deleteItemAsync(`${base}.${record.generation}.${i}`),
        ),
      );
  };
  return {
    getItem: (key: string) =>
      exclusive(async () => {
        const base = root(key);
        const record = manifest(await vault.getItemAsync(base));
        if (!record) return null;
        const parts = await Promise.all(
          Array.from({ length: record.count }, (_, i) =>
            vault.getItemAsync(`${base}.${record.generation}.${i}`),
          ),
        );
        if (parts.some((p) => p === null))
          throw new Error("会话存储不完整，请重新登录。");
        return parts.join("");
      }),
    setItem: (key: string, value: string) =>
      exclusive(async () => {
        const base = root(key);
        let previous: Manifest | null = null;
        try {
          previous = manifest(await vault.getItemAsync(base));
        } catch {
          /* A fresh sign-in replaces corrupt metadata. */
        }
        const parts = value.match(/[\s\S]{1,400}/gu) ?? [""];
        if (parts.length > 1000)
          throw new Error("会话数据过大，无法安全保存。");
        const next = {
          generation: `${Date.now().toString(36)}-${(++serial).toString(36)}`,
          count: parts.length,
        };
        try {
          for (const [i, part] of parts.entries())
            await vault.setItemAsync(`${base}.${next.generation}.${i}`, part);
          await vault.setItemAsync(base, JSON.stringify(next));
        } catch (error) {
          await clear(base, next).catch(() => {});
          throw error;
        }
        await clear(base, previous).catch(() => {});
      }),
    removeItem: (key: string) =>
      exclusive(async () => {
        const base = root(key);
        let record: Manifest | null = null;
        try {
          record = manifest(await vault.getItemAsync(base));
        } catch {
          /* Corrupt manifests must not prevent sign-out. */
        }
        await vault.deleteItemAsync(base);
        await clear(base, record);
      }),
  };
}
