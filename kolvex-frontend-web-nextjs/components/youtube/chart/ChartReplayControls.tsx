"use client";

import { useRef } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REPLAY_SPEEDS, type ReplaySpeed } from "@/lib/chart/replay";

type Translate = (key: string) => string;

export default function ChartReplayControls({
  choosing,
  position,
  count,
  date,
  playing,
  speed,
  onSeek,
  onStart,
  onToggle,
  onSpeed,
  t,
}: {
  choosing: boolean;
  position: number;
  count: number;
  date: string;
  playing: boolean;
  speed: ReplaySpeed;
  onSeek: (index: number) => void;
  onStart: () => void;
  onToggle: () => void;
  onSpeed: (speed: ReplaySpeed) => void;
  t: Translate;
}) {
  const timeline = useRef<HTMLInputElement>(null);
  const label = (key: string) => t(`youtubeOpinions.replay.${key}`);
  const finished = position === count - 1;
  const playbackLabel = label(playing ? "pause" : "play");
  return (
    <div
      role="group"
      aria-label={label("title")}
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border py-1.5"
    >
      {choosing ? (
        <span className="grow text-xs font-medium text-foreground" role="status">
          {label("pickHint")}
        </span>
      ) : (
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="toolbar"
            size="toolbar"
            className="focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={label("previous")}
            title={label("previous")}
            disabled={position === 0}
            onClick={() => onSeek(position - 1)}
          >
            <SkipBack className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="toolbar"
            size="toolbar"
            className="focus-visible:ring-1 focus-visible:ring-ring"
            selected
            aria-label={playbackLabel}
            title={playbackLabel}
            disabled={finished}
            onClick={onToggle}
          >
            {playing ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
          <Button
            type="button"
            variant="toolbar"
            size="toolbar"
            className="focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={label("next")}
            title={label("next")}
            disabled={finished}
            onClick={() => onSeek(position + 1)}
          >
            <SkipForward className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
      <div className="order-last flex min-w-0 basis-full items-center gap-2 sm:order-none sm:flex-1 sm:basis-auto">
        <input
          ref={timeline}
          type="range"
          min={0}
          max={count - 1}
          value={position}
          aria-label={label(choosing ? "start" : "position")}
          aria-valuetext={date}
          onChange={(event) => onSeek(event.currentTarget.valueAsNumber)}
          className="h-8 min-w-0 flex-1 cursor-pointer accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:h-7"
        />
        <span className="shrink-0 text-xs tabular-nums text-foreground">{date}</span>
      </div>
      {choosing ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="max-sm:min-h-11"
          onClick={() => {
            onStart();
            timeline.current?.focus();
          }}
        >
          {label("confirm")}
        </Button>
      ) : (
        <>
          <Select
            value={String(speed)}
            onValueChange={(value) => onSpeed(Number(value) as ReplaySpeed)}
          >
            <SelectTrigger
              aria-label={label("speed")}
              className="!h-11 !w-auto shrink-0 px-2.5 text-xs tabular-nums sm:!h-7"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
              {REPLAY_SPEEDS.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}×
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span role="status" className="text-xs text-muted-foreground">
            {label(finished ? "finished" : playing ? "playing" : "paused")}
          </span>
        </>
      )}
    </div>
  );
}
