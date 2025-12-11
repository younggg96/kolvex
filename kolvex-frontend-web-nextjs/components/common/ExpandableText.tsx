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
      <div className="text-gray-700 dark:text-white/90 leading-relaxed whitespace-pre-wrap">
        {onFormatText ? onFormatText(displayText) : displayText}
        {needsTruncation && !isExpanded && (
          <span className="text-gray-400">...</span>
        )}
      </div>

      {needsTruncation && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-sm text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300 font-medium transition-colors inline-flex items-center gap-1"
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
