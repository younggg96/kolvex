import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import BaseLayout from "@/components/layout/BaseLayout";
import { LegalLocaleSwitch } from "./LegalLocaleSwitch";

/**
 * Server component: both language versions are rendered on the server and the client
 * only picks one, so react-markdown stays out of the page's JavaScript.
 */
export function LegalPage({
  kind,
  chinese,
  children,
}: {
  kind: "privacy" | "terms";
  chinese: string;
  children: ReactNode;
}) {
  return (
    <BaseLayout>
      <article className="prose prose-sm mx-auto w-full max-w-4xl break-words px-4 py-12 text-foreground dark:prose-invert sm:prose-base md:px-8">
        <LegalLocaleSwitch kind={kind} zh={<ReactMarkdown>{chinese}</ReactMarkdown>}>
          {children}
        </LegalLocaleSwitch>
      </article>
    </BaseLayout>
  );
}
