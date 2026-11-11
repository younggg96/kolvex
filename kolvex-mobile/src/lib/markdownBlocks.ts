export type TextBlock =
  | { kind: "heading" | "paragraph" | "bullet"; text: string }
  | { kind: "rule" }
  | { kind: "table"; header: string[]; rows: string[][] };
const cells = (line: string) =>
  line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
const isDivider = (line: string) =>
  /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line);
/** The small Markdown subset AI reports and chat answers actually use. */
export function textBlocks(source: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length)
      blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };
  const lines = source.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    // A GitHub table: header row, a |---| divider, then body rows.
    if (
      line.startsWith("|") &&
      index + 1 < lines.length &&
      isDivider(lines[index + 1].trim())
    ) {
      flush();
      const header = cells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(cells(lines[index].trim()));
        index++;
      }
      index--;
      blocks.push({ kind: "table", header, rows });
      continue;
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (!line) flush();
    else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flush();
      blocks.push({ kind: "rule" });
    } else if (heading) {
      flush();
      blocks.push({ kind: "heading", text: heading[1] });
    } else if (bullet) {
      flush();
      blocks.push({ kind: "bullet", text: bullet[1] });
    } else paragraph.push(line);
  }
  flush();
  return blocks;
}
