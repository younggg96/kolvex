import { Share } from "react-native";
export async function exportCSV(name: string, content: string) {
  await Share.share({ title: name, message: content });
}
