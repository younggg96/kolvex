import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export const PROSE_CLASSES = cn(
  "prose prose-sm dark:prose-invert max-w-none text-[13px]",
  "prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:font-semibold",
  "prose-h2:text-sm prose-h3:text-xs",
  "prose-p:my-1 prose-p:leading-relaxed prose-p:text-[13px]",
  "prose-ul:my-1 prose-ul:pl-4 prose-li:my-0.5 prose-li:text-[13px]",
  "prose-ol:my-1 prose-ol:pl-4",
  "prose-strong:text-foreground prose-strong:font-semibold",
  "prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
  "prose-pre:bg-muted prose-pre:rounded-lg prose-pre:text-xs",
  "prose-table:text-xs prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
);

export function MarkdownBody({ content }: { content: string }) {
  return (
    <div className={PROSE_CLASSES}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
