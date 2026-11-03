export type TextBlock =
  { kind: "heading" | "paragraph" | "bullet"; text: string } | { kind: "rule" };
/** The small Markdown subset AI reports and chat answers actually use. */
export function textBlocks(source: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length)
      blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };
  for (const raw of source.split("\n")) {
    const line = raw.trim();
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
