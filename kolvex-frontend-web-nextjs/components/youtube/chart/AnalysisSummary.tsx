"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Keep a long conclusion readable without removing any of the saved text. */
export default function AnalysisSummary({ text, t }: {
  text: string;
  t: (key: string) => string;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 240 || text.split("\n").length > 4;
  return (
    <div className="max-w-[72ch]">
      <p id={id} className={cn("whitespace-pre-line break-words text-base leading-7", long && !expanded && "line-clamp-4")}>{text}</p>
      {long && <Button type="button" size="sm" variant="ghost" className="mt-2 text-muted-foreground"
        aria-controls={id} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
        {t(expanded ? "youtubeOpinions.ai.readLess" : "youtubeOpinions.ai.readMore")}
        <ChevronDown className={cn("h-4 w-4", expanded && "rotate-180")} aria-hidden="true" />
      </Button>}
    </div>
  );
}
