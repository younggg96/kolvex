import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) =>
  readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

// `useResource({ cache: true })` keeps private snapshots (chat history) for the app's
// lifetime, so the auth layer must drop them when the signed-in account changes.
test("cached resources are forgotten when the account changes", () => {
  const resource = read("lib/useResource.ts");
  assert.match(
    resource,
    /export function forgetResources\(\)\s*\{\s*cache\.clear\(\);/,
  );

  const auth = read("state/Auth.tsx");
  assert.match(
    auth,
    /import \{ forgetResources \} from "\.\.\/lib\/useResource";/,
  );
  assert.match(
    auth,
    /if \(user !== undefined && user !== id\) forgetResources\(\);/,
  );
  // Both the auth event stream and the initial session restore report the user.
  assert.match(auth, /observe\(value\);\s*setSession\(value\);/);
  assert.match(
    auth,
    /observe\(result\.data\.session\);\s*setSession\(result\.data\.session\);/,
  );
});
