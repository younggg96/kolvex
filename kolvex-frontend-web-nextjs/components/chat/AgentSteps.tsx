"use client";

/**
 * Agent step list shown while Kolvex works on an answer.
 * Motion adapted from Kokonut UI "AI Loading State" (MIT, https://kokonutui.com).
 */

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { ToolStatus } from "./types";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const formatDuration = (seconds: number) =>
  seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${(seconds % 60).toString().padStart(2, "0")}s`;

const formatStepTime = (ms: number) =>
  ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`;

/** Seconds since this run started; freezes once nothing is active. */
function useElapsed(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const start = startRef.current ?? Date.now();
    startRef.current = start;
    const tick = () => setSeconds(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [active]);

  return seconds;
}

/** Times each tool from when it is first seen running to when it is done. */
function useStepTimes(tools: ToolStatus[]) {
  const [times, setTimes] = useState<Record<string, number>>({});
  const startsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const now = Date.now();
    const starts = startsRef.current;
    let next: Record<string, number> | null = null;
    for (const tool of tools) {
      starts[tool.name] ??= now;
      if (tool.status === "done" && !(tool.name in times)) {
        next ??= { ...times };
        next[tool.name] = now - starts[tool.name];
      }
    }
    if (next) setTimes(next);
  }, [tools, times]);

  return times;
}

function StepIcon({ status }: { status: ToolStatus["status"] }) {
  return (
    <span className="relative flex size-4 shrink-0 items-center justify-center">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={status}
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0, filter: "blur(2px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(2px)" }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          {status === "running" ? (
            <svg
              aria-hidden="true"
              className="size-3.5 motion-safe:animate-spin"
              style={{ animationDuration: "0.8s" }}
              fill="none"
              viewBox="0 0 16 16"
            >
              <circle className="stroke-border" cx="8" cy="8" r="6.25" strokeWidth="1.5" />
              <path
                className="stroke-positive"
                d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              className="size-3.5 text-positive"
              fill="none"
              viewBox="0 0 16 16"
            >
              {/* The check draws itself once, from the short stroke out. */}
              <motion.path
                d="M3.5 8.5 6.5 11.5 12.5 4.5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.05 }}
              />
            </svg>
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A soft brightness wave through the letters of the active label. */
function WaveText({ text }: { text: string }) {
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {Array.from(text).map((char, i) => (
          <span
            // Letters of one fixed label, never reordered.
            key={i}
            className="whitespace-pre motion-safe:animate-ai-wave"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            {char}
          </span>
        ))}
      </span>
    </>
  );
}

function StepRow({ tool, time, isLast }: { tool: ToolStatus; time?: number; isLast: boolean }) {
  const isDone = tool.status === "done";
  return (
    <li className="relative flex gap-2.5 pt-3">
      {/* The rail between icons fills in as each step completes. */}
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute bottom-[-10px] left-[7.5px] top-[30px] w-px overflow-hidden bg-border"
        >
          <span
            className={cn(
              "block h-full w-full origin-top bg-positive/60 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
              isDone ? "scale-y-100" : "scale-y-0",
            )}
          />
        </span>
      )}
      <StepIcon status={tool.status} />
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <p
          className={cn(
            "min-w-0 truncate text-xs leading-4 transition-colors duration-200",
            isDone ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {isDone ? tool.label : <WaveText text={tool.label} />}
        </p>
        {time !== undefined && (
          <motion.span
            className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            {formatStepTime(time)}
          </motion.span>
        )}
      </div>
    </li>
  );
}

/**
 * Agent activity: current stage + elapsed time in a header, the tool calls
 * as a step list with a rail that fills as each one completes.
 */
export function AgentSteps({
  tools,
  isThinking,
  modelName,
  statusMessage,
}: {
  tools: ToolStatus[];
  isThinking: boolean;
  modelName?: string;
  statusMessage?: string;
}) {
  const { t } = useTranslation();
  const listId = useId();
  const [isOpen, setIsOpen] = useState(true);
  const isActive = isThinking || tools.some((tool) => tool.status === "running");
  const seconds = useElapsed(isActive);
  const times = useStepTimes(tools);

  if (!isThinking && tools.length === 0) return null;

  const title = statusMessage || t("chat.activity.working");

  return (
    // Starts just after a sent question's bubble so the two do not arrive at once.
    <div className="flex w-full justify-start animate-fade-in [animation-delay:180ms] [animation-fill-mode:both]">
      <MotionConfig reducedMotion="user">
        <div className="w-full max-w-[45rem]">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{t("chat.assistantName")}</span>
            {modelName && <span>{modelName}</span>}
          </div>

          <button
            type="button"
            aria-controls={listId}
            aria-expanded={isOpen}
            aria-label={t("chat.activity.toggleSteps")}
            onClick={() => setIsOpen((open) => !open)}
            className="group/header flex w-full max-w-sm items-center gap-2 rounded-md py-1 text-left text-xs font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {/* <output> has the implicit role="status", so stage changes are announced. */}
            <output className="min-w-0 truncate text-foreground/80">
              {isThinking ? <WaveText text={title} /> : title}
            </output>
            <span className="tabular-nums text-muted-foreground/70">{formatDuration(seconds)}</span>
            {tools.length > 0 && (
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "ml-auto size-3.5 text-muted-foreground/70 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/header:text-foreground",
                  isOpen && "rotate-180",
                )}
              />
            )}
          </button>

          <AnimatePresence initial={false}>
            {isOpen && tools.length > 0 && (
              <motion.ol
                id={listId}
                className="max-w-sm overflow-hidden"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                {tools.map((tool, i) => (
                  <StepRow
                    key={tool.name}
                    tool={tool}
                    time={times[tool.name]}
                    isLast={i === tools.length - 1}
                  />
                ))}
              </motion.ol>
            )}
          </AnimatePresence>
        </div>
      </MotionConfig>
    </div>
  );
}
