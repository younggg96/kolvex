import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
export async function exportCSV(name: string, content: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("系统分享不可用");
  const file = new File(
    Paths.cache,
    `${name.replace(/[^A-Za-z0-9_-]/g, "_")}-${Date.now()}.csv`,
  );
  try {
    file.create();
    file.write("\uFEFF" + content);
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/csv",
      UTI: "public.comma-separated-values-text",
      dialogTitle: name,
    });
  } finally {
    if (file.exists) file.delete();
  }
}
