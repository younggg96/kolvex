"use client";

import { useState } from "react";

interface TagsProps {
  tags: string[];
  maxVisible?: number;
}

export default function Tags({ tags, maxVisible = 5 }: TagsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!tags || tags.length === 0) return null;

  const shouldShowButton = tags.length > maxVisible;
  const displayedTags = isExpanded ? tags : tags.slice(0, maxVisible);

  return (
    <div className="flex flex-wrap gap-1.5">
      {displayedTags.map((tag, index) => (
        <span
          key={index}
          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20"
        >
          {tag}
        </span>
      ))}
      
      {shouldShowButton && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
        >
          {isExpanded ? "Show Less" : `+${tags.length - maxVisible}`}
        </button>
      )}
    </div>
  );
}

