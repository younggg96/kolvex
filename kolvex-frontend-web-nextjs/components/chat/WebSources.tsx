"use client";

import type { WebSource } from "@/lib/chatApi";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

const STACK_LIMIT = 3;
/** Opening one answer's sources closes any other answer's panel. */
const OPEN_EVENT = "kolvex:web-sources-open";

function faviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

function Favicon({ domain, className }: { domain: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-muted text-[0.5625rem] font-semibold uppercase text-muted-foreground",
          className,
        )}
      >
        {domain.charAt(0)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={faviconUrl(domain)}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn("rounded-full bg-muted object-cover", className)}
    />
  );
}

/** Sources grouped by the search that found them, in the order the searches ran. */
function groupByQuery(sources: WebSource[]) {
  const groups = new Map<string, WebSource[]>();
  for (const source of sources) {
    const list = groups.get(source.query) ?? [];
    list.push(source);
    groups.set(source.query, list);
  }
  return Array.from(groups, ([query, items]) => ({ query, items }));
}

/** Open state for one answer's sources panel; only one panel is open on the page. */
export function useWebSourcesPanel() {
  const id = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) setOpen(false);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [id]);

  const toggle = () => {
    if (!open) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    setOpen(!open);
  };
  return { open, toggle, close: () => setOpen(false) };
}

/** "N sources" under an answer: stacked site icons that open the sources panel. */
export function WebSourcesButton({
  sources,
  open,
  onToggle,
}: {
  sources: WebSource[];
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const domains = Array.from(new Set(sources.map((s) => s.domain))).slice(0, STACK_LIMIT);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex items-center gap-2 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
    >
      <span className="flex -space-x-1.5">
        {domains.map((domain) => (
          <Favicon key={domain} domain={domain} className="h-4 w-4 ring-2 ring-background" />
        ))}
      </span>
      <span>
        {sources.length === 1
          ? t("chat.sources.countOne")
          : t("chat.sources.count", { count: String(sources.length) })}
      </span>
    </button>
  );
}

/** Floating panel listing every page the answer's web searches returned. */
export function WebSourcesPanel({
  sources,
  onClose,
}: {
  sources: WebSource[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  // Portaled to <body> so no transformed or blurred ancestor turns `fixed` into `absolute`.
  return createPortal(
    <aside
      aria-label={t("chat.sources.title")}
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-lg",
        "inset-x-3 bottom-3 max-h-[70vh]",
        "lg:inset-x-auto lg:bottom-auto lg:right-4 lg:top-16 lg:max-h-[calc(100vh-6rem)] lg:w-[19.5rem]",
      )}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("chat.sources.close")}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>{t("chat.sources.title")}</span>
        <ChevronDown className="h-4 w-4" />
      </button>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-3">
        {groupByQuery(sources).map(({ query, items }) => (
          <section key={query}>
            {query && (
              <p className="mb-2 text-xs text-muted-foreground">
                {t("chat.sources.resultsFor", { query })}
              </p>
            )}
            <ul className="space-y-1">
              {items.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="-mx-2 block rounded-xl px-2 py-2 transition-colors hover:bg-foreground/[0.05]"
                  >
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Favicon domain={source.domain} className="h-4 w-4 shrink-0" />
                      <span className="truncate">{source.domain}</span>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-sm font-medium leading-snug text-foreground">
                      {source.title}
                    </span>
                    {source.snippet && (
                      <span className="mt-1 line-clamp-3 block text-xs leading-relaxed text-muted-foreground">
                        {source.snippet}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>,
    document.body,
  );
}
