"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CLAMPED_LINES = 3;

/**
 * Clamp the conclusion to three rendered lines and only offer expansion when the
 * text actually overflows at the current width. Character counts are not used:
 * the same conclusion can fit or overflow depending on the chart panel width.
 */
export default function AnalysisSummary({ text, t }: {
  text: string;
  t: (key: string) => string;
}) {
  const id = useId();
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [text]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const lineHeight = Number.parseFloat(getComputedStyle(node).lineHeight) || 28;
      // `clipped` covers the clamped state; `taller` also works after expansion
      // and when an engine reports the clamped scrollHeight instead of the full one.
      const clipped = node.scrollHeight - node.clientHeight > 1;
      const taller = node.scrollHeight > lineHeight * CLAMPED_LINES + 1;
      setOverflowing(clipped || taller);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.parentElement) observer.observe(node.parentElement);
    if (typeof document !== "undefined" && document.fonts) {
      void document.fonts.ready.then(measure);
    }
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [text]);

  return (
    <div className="min-w-0">
      <p
        id={id}
        ref={ref}
        className={cn(
          "whitespace-pre-line break-words text-base leading-7",
          !expanded && "line-clamp-3",
        )}
      >
        {text}
      </p>
      {overflowing && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-2 text-muted-foreground"
          aria-controls={id}
          aria-expanded={expanded}
          onClick={() => setExpanded(value => !value)}
        >
          {t(expanded ? "youtubeOpinions.ai.readLess" : "youtubeOpinions.ai.readMore")}
          <ChevronDown className={cn("h-4 w-4", expanded && "rotate-180")} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
