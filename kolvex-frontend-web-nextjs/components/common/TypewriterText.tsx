"use client";

import { useState, useEffect, useRef } from "react";

interface TypewriterTextProps {
  phrases: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  delayBetweenPhrases?: number;
  className?: string;
}

export default function TypewriterText({
  phrases,
  typingSpeed = 100,
  deletingSpeed = 50,
  delayBetweenPhrases = 2000,
  className = "",
}: TypewriterTextProps) {
  const [mounted, setMounted] = useState(false);
  const [displayText, setDisplayText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || phrases.length === 0) return;

    const currentPhrase = phrases[phraseIndex];

    const handleTyping = () => {
      if (!isDeleting) {
        // Typing
        if (displayText.length < currentPhrase.length) {
          setDisplayText(currentPhrase.substring(0, displayText.length + 1));
          timeoutRef.current = setTimeout(handleTyping, typingSpeed);
        } else {
          // Finished typing, wait before deleting
          timeoutRef.current = setTimeout(() => {
            setIsDeleting(true);
          }, delayBetweenPhrases);
        }
      } else {
        // Deleting
        if (displayText.length > 0) {
          setDisplayText(currentPhrase.substring(0, displayText.length - 1));
          timeoutRef.current = setTimeout(handleTyping, deletingSpeed);
        } else {
          // Finished deleting, move to next phrase
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % phrases.length);
        }
      }
    };

    timeoutRef.current = setTimeout(
      handleTyping,
      isDeleting ? deletingSpeed : typingSpeed
    );

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    mounted,
    displayText,
    phraseIndex,
    isDeleting,
    phrases,
    typingSpeed,
    deletingSpeed,
    delayBetweenPhrases,
  ]);

  // Show first phrase as static text on server/before mount for SEO
  const staticText = phrases.length > 0 ? phrases[0] : "\u00A0";

  return (
    <span className={`inline-block ${className}`}>
      <span className="break-words">
        {mounted ? displayText || "\u00A0" : staticText}
      </span>
      <span className="animate-pulse text-primary ml-0.5">|</span>
    </span>
  );
}
