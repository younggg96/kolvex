import { nativePathFor } from "../lib/deepLinks";
export function redirectSystemPath({ path }: { path: string }) {
  return nativePathFor(path);
}
