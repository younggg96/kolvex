"use client";

import React, { useState, useMemo } from "react";

interface ExpandableTextProps {
  text: string;
  maxWords?: number;
  onFormatText?: (text: string) => React.ReactNode;
  className?: string;
}

export default function ExpandableText({
  text,
  maxWords = 80,
  onFormatText,
  className = "",
}: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Split text into words and calculate if truncation is needed
  const { truncatedText, needsTruncation } = useMemo(() => {
    const words = text.split(/\s+/);
    const needsTruncation = words.length > maxWords;
    const truncatedText = needsTruncation
      ? words.slice(0, maxWords).join(" ")
      : text;

    return { truncatedText, needsTruncation };
  }, [text, maxWords]);

  const displayText = isExpanded ? text : truncatedText;

  return (
    <div className={`${className}`}>
      <div className="text-foreground leading-relaxed whitespace-pre-wrap">
        {onFormatText ? onFormatText(displayText) : displayText}
        {needsTruncation && !isExpanded && (
          <span className="text-muted-foreground">...</span>
        )}
      </div>

      {needsTruncation && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-sm text-foreground hover:text-foreground font-medium transition-colors inline-flex items-center gap-1"
        >
          {isExpanded ? (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
              <span>less</span>
            </>
          ) : (
            <>
              <span>more</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </>
          )}
        </button>
      )}
    </div>
  );
}
