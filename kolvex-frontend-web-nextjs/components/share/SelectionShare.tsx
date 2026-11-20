"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Share2 } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { MAX_SELECTION_CHARS, type ShareCard } from "@/lib/contentShare";
import { ShareDialog } from "./ShareDialog";

type Spot = { text: string; top: number; left: number; below: boolean };

/**
 * Wraps an AI answer: selecting part of it shows a "Share selection" button. The backend
 * checks the passage is part of the stored answer before creating the link.
 */
export function SelectionShare({
  messageId,
  question,
  children,
}: {
  messageId: string;
  question?: string;
  children: ReactNode;
}) {
  const c = useCopy();
  const ref = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [excerpt, setExcerpt] = useState<string | null>(null);

  const measure = useCallback(() => {
    const selection = window.getSelection();
    const root = ref.current;
    if (!selection || selection.isCollapsed || !root || selection.rangeCount === 0) {
      setSpot(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) {
      setSpot(null);
      return;
    }
    const text = selection.toString().trim();
    if (Array.from(text).length < 2 || text.length > MAX_SELECTION_CHARS) {
      setSpot(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    // Touch devices draw their own menu above the selection.
    const below = window.matchMedia("(pointer: coarse)").matches || rect.top < 64;
    setSpot({
      text,
      top: below ? rect.bottom + 10 : rect.top - 46,
      left: Math.min(Math.max(rect.left + rect.width / 2, 80), window.innerWidth - 80),
      below,
    });
  }, []);

  useEffect(() => {
    const onChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) setSpot(null);
    };
    const hide = () => setSpot(null);
    document.addEventListener("selectionchange", onChange);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);

  const preview: ShareCard | undefined =
    excerpt === null
      ? undefined
      : {
          v: 1,
          title: question || "",
          summary: "",
          tickers: [],
          data: { question: question || "", answer: excerpt, excerpt: true },
        };

  return (
    <div
      ref={ref}
      onMouseUp={() => window.setTimeout(measure, 0)}
      onTouchEnd={() => window.setTimeout(measure, 350)}
      onKeyUp={(event) => event.shiftKey && measure()}
    >
      {children}
      {spot && (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setExcerpt(spot.text);
            setSpot(null);
          }}
          style={{ top: spot.top, left: spot.left }}
          className="fixed z-50 inline-flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border border-foreground/10 bg-popover px-3.5 text-xs font-medium text-popover-foreground shadow-lg animate-fade-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          {c("Share selection", "分享所选内容")}
        </button>
      )}
      {excerpt !== null && (
        <ShareDialog
          open
          onOpenChange={(open) => !open && setExcerpt(null)}
          target={{ kind: "chat", sourceId: messageId, excerpt }}
          preview={preview}
        />
      )}
    </div>
  );
}
