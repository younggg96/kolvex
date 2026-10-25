import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export const PROSE_CLASSES = cn(
  "prose w-full min-w-0 max-w-none dark:prose-invert break-words text-base leading-[1.85] text-foreground/90 md:text-[17px]",
  "prose-headings:mt-10 prose-headings:mb-4 prose-headings:font-semibold prose-headings:leading-snug prose-headings:text-foreground",
  "prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base",
  "prose-headings:tracking-tight [&_h3:not(:first-child)]:border-t [&_h3:not(:first-child)]:border-border [&_h3:not(:first-child)]:pt-8",
  "prose-p:my-5 prose-p:leading-[1.85]",
  "prose-ul:my-5 prose-ul:pl-6 prose-li:my-2 prose-li:leading-[1.85]",
  "prose-ol:my-5 prose-ol:pl-6 prose-hr:my-10",
  "prose-li:pl-2 marker:font-medium marker:text-muted-foreground [&_li>p]:my-2",
  "prose-strong:text-foreground prose-strong:font-semibold",
  "prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-normal prose-code:before:content-none prose-code:after:content-none",
  "prose-pre:bg-muted prose-pre:rounded-lg prose-pre:text-sm",
  "prose-table:my-0 prose-table:w-full prose-table:text-sm prose-th:bg-muted/60 prose-th:px-4 prose-th:py-3 prose-th:font-semibold prose-td:px-4 prose-td:py-3 prose-td:align-top",
  "prose-a:text-foreground prose-a:decoration-border prose-a:underline-offset-4 hover:prose-a:decoration-foreground focus-visible:prose-a:outline focus-visible:prose-a:outline-2 focus-visible:prose-a:outline-offset-4 focus-visible:prose-a:outline-ring",
  "prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:border-l prose-blockquote:border-l-border prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg [&_blockquote_p:first-of-type]:before:content-none [&_blockquote_p:last-of-type]:after:content-none",
  "prose-em:text-foreground/90 prose-pre:overflow-x-auto [overflow-wrap:anywhere]",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
);

export function MarkdownBody({ content }: { content: string }) {
  return (
    <div className={PROSE_CLASSES}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h3 className="text-xl md:text-2xl">{children}</h3>,
          h2: ({ children }) => <h3 className="text-lg md:text-xl">{children}</h3>,
          h3: ({ children }) => <h4 className="text-base md:text-lg">{children}</h4>,
          table: ({ children }) => (
            <div role="region" aria-label="Data table" tabIndex={0} className="my-6 w-full min-w-0 max-w-full overflow-x-auto rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <table>{children}</table>
            </div>
          ),
        }}
      >{content}</ReactMarkdown>
    </div>
  );
}
