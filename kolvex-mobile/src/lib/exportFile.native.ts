import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
export const exportCSV = (name: string, content: string) =>
  exportText(
    name,
    "csv",
    "text/csv",
    "public.comma-separated-values-text",
    `\uFEFF${content}`,
  );
export async function exportText(
  name: string,
  extension: string,
  mimeType: string,
  UTI: string,
  content: string,
) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("系统分享不可用");
  const file = new File(
    Paths.cache,
    `${name.replace(/[^A-Za-z0-9_-]/g, "_")}-${Date.now()}.${extension}`,
  );
  try {
    file.create();
    file.write(content);
    await Sharing.shareAsync(file.uri, {
      mimeType,
      UTI,
      dialogTitle: name,
    });
  } finally {
    if (file.exists) file.delete();
  }
}
