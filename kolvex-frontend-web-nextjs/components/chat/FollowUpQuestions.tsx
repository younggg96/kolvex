"use client";

import { CornerDownRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface FollowUpQuestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
  disabled?: boolean;
}

/** Next questions the latest answer suggested; picking one sends it as the user's message. */
export function FollowUpQuestions({ questions, onSelect, disabled }: FollowUpQuestionsProps) {
  const { t } = useTranslation();
  if (!questions.length) return null;

  return (
    <nav aria-label={t("chat.followUps.label")} className="border-t border-border/60 pt-2">
      <ul className="flex flex-col">
        {questions.map((question) => (
          <li key={question}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(question)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              <CornerDownRight
                aria-hidden
                className="h-4 w-4 flex-shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 break-words">{question}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
