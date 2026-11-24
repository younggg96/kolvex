"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Flash = { dir: "up" | "down"; id: number } | null;

/**
 * Flashes its background in the market up/down colour when a live `value` ticks.
 * Never on first data, while `value` is undefined (e.g. the user is scrubbing a chart),
 * or when `identity` changes (another symbol or range is a new series, not a tick).
 */
export function PriceFlash({
  value,
  identity,
  className,
  children,
}: {
  value: number | null | undefined;
  identity?: string;
  className?: string;
  children: ReactNode;
}) {
  const previous = useRef<{ identity?: string; value?: number }>({ identity });
  const [flash, setFlash] = useState<Flash>(null);

  useEffect(() => {
    const last = previous.current;
    if (last.identity !== identity) {
      previous.current = { identity };
      setFlash(null);
    }
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    const before = previous.current.value;
    previous.current = { identity, value };
    if (before === undefined || before === value) return;
    setFlash((current) => ({ dir: value > before ? "up" : "down", id: (current?.id ?? 0) + 1 }));
  }, [value, identity]);

  return (
    // A new key restarts the animation on every tick, even in the same direction.
    <span
      key={flash?.id ?? 0}
      className={cn(
        className,
        flash && (flash.dir === "up" ? "price-flash-up" : "price-flash-down"),
      )}
    >
      {children}
    </span>
  );
}
