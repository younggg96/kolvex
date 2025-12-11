"use client";

import { useState } from "react";
import { Languages } from "lucide-react";

interface TranslateButtonProps {
  text: string;
  onTranslate?: (translated: string) => void;
  className?: string;
}

export default function TranslateButton({
  text,
  onTranslate,
  className = "",
}: TranslateButtonProps) {
  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedText, setTranslatedText] = useState<string>("");
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Toggle back to original
    if (isTranslated) {
      setIsTranslated(false);
      if (onTranslate) {
        onTranslate(text);
      }
      return;
    }

    // Use cached translation
    if (translatedText) {
      setIsTranslated(true);
      if (onTranslate) {
        onTranslate(translatedText);
      }
      return;
    }

    // Fetch new translation
    setIsTranslating(true);
    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(
          text
        )}`
      );
      const data = await response.json();
      const translated = data[0].map((item: any[]) => item[0]).join("");
      setTranslatedText(translated);
      setIsTranslated(true);
      if (onTranslate) {
        onTranslate(translated);
      }
    } catch (error) {
      console.error("Translation failed:", error);
      const errorMessage = "翻译失败，请稍后重试。";
      setTranslatedText(errorMessage);
      setIsTranslated(true);
      if (onTranslate) {
        onTranslate(errorMessage);
      }
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div
      onClick={isTranslating ? undefined : handleTranslate}
      onKeyDown={(e) => {
        if (!isTranslating && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleTranslate(e as any);
        }
      }}
      role="button"
      tabIndex={isTranslating ? -1 : 0}
      aria-label={isTranslated ? "显示原文" : "翻译"}
      className={`flex items-center gap-1 text-xs transition-colors cursor-pointer ${
        isTranslated
          ? "text-primary"
          : "text-gray-600 dark:text-gray-400 hover:text-primary"
      } ${isTranslating ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      title={isTranslated ? "显示原文" : "翻译"}
    >
      <Languages
        className={`w-3 h-3 ${isTranslating ? "animate-pulse" : ""}`}
      />
    </div>
  );
}

// Hook for using translation in components
export function useTranslation(initialText: string) {
  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedText, setTranslatedText] = useState<string>("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [currentText, setCurrentText] = useState(initialText);

  const translate = async () => {
    if (isTranslated) {
      setIsTranslated(false);
      setCurrentText(initialText);
      return;
    }

    if (translatedText) {
      setIsTranslated(true);
      setCurrentText(translatedText);
      return;
    }

    setIsTranslating(true);
    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(
          initialText
        )}`
      );
      const data = await response.json();
      const translated = data[0].map((item: any[]) => item[0]).join("");
      setTranslatedText(translated);
      setCurrentText(translated);
      setIsTranslated(true);
    } catch (error) {
      console.error("Translation failed:", error);
      const errorMessage = "翻译失败，请稍后重试。";
      setTranslatedText(errorMessage);
      setCurrentText(errorMessage);
      setIsTranslated(true);
    } finally {
      setIsTranslating(false);
    }
  };

  return {
    currentText,
    isTranslated,
    isTranslating,
    translate,
  };
}
