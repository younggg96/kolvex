import { Share } from "react-native";
export async function exportCSV(name: string, content: string) {
  await Share.share({ title: name, message: content });
}
export async function exportText(
  name: string,
  _extension: string,
  _mimeType: string,
  _UTI: string,
  content: string,
) {
  await Share.share({ title: name, message: content });
}
