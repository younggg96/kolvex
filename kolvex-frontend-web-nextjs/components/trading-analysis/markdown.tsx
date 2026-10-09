import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export const PROSE_CLASSES = cn(
  "prose dark:prose-invert max-w-[72ch] break-words text-base leading-[1.85] text-foreground/90 md:text-[17px]",
  "prose-headings:mt-10 prose-headings:mb-4 prose-headings:font-semibold prose-headings:leading-snug prose-headings:text-foreground",
  "prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base",
  "prose-p:my-4 prose-p:leading-[1.85]",
  "prose-ul:my-5 prose-ul:pl-6 prose-li:my-2 prose-li:leading-[1.85]",
  "prose-ol:my-5 prose-ol:pl-6 prose-hr:my-10",
  "prose-strong:text-foreground prose-strong:font-semibold",
  "prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
  "prose-pre:bg-muted prose-pre:rounded-lg prose-pre:text-sm",
  "prose-table:my-0 prose-table:text-sm prose-th:px-3 prose-th:py-3 prose-td:px-3 prose-td:py-3",
  "prose-a:text-foreground prose-a:underline-offset-4 prose-blockquote:font-normal prose-blockquote:not-italic",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
);

export function MarkdownBody({ content }: { content: string }) {
  return (
    <div className={PROSE_CLASSES}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h3 className="!text-[22px]">{children}</h3>,
          h2: ({ children }) => <h3 className="!text-xl">{children}</h3>,
          h3: ({ children }) => <h4 className="!text-lg">{children}</h4>,
          table: ({ children }) => (
            <div className="my-6 max-w-full overflow-x-auto rounded-lg border border-border">
              <table>{children}</table>
            </div>
          ),
        }}
      >{content}</ReactMarkdown>
    </div>
  );
}
