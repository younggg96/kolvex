"use client";

/**
 * Command search: a search field that rests as a small pill and springs open.
 *
 * Adapted from "Command button" by DesignBookmark (designbookmark.com/motion, MIT).
 * Same springs: press 520/34/0.6, open stiffness 300 with damping 34 − bounce·0.2,
 * label/field swap 0.18s with a blur. Kolvex differences:
 * - Colours come from theme tokens, never hex.
 * - `bounce` defaults to 0 (Kolvex motion never overshoots, see lib/motion/spring.ts).
 * - The real field (children) stays mounted while folded, so refs, IME handling,
 *   suggestion lists and page shortcuts that call `.focus()` keep working. Focusing
 *   the field opens it; Tab reaches the field directly, the pill is mouse-only.
 * - It stays open while it has text (`hasValue`) or focus. Esc clears, a second Esc folds.
 */

import * as React from "react";
import { Search } from "lucide-react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { cn } from "@/lib/utils";

const PRESS = { stiffness: 520, damping: 34, mass: 0.6 };
const openSpring = (bounce: number) => ({
  type: "spring" as const,
  stiffness: 300,
  damping: 34 - (Math.min(100, Math.max(0, bounce)) / 100) * 20,
});
const SWAP = { duration: 0.18, ease: [0.23, 1, 0.32, 1] } as const;

type Modifier = "mod" | "ctrl" | "alt" | "shift";
const MODIFIERS: Modifier[] = ["mod", "ctrl", "alt", "shift"];
const MAC: Record<Modifier, string> = { mod: "⌘", ctrl: "⌃", alt: "⌥", shift: "⇧" };
const PC: Record<Modifier, string> = { mod: "Ctrl", ctrl: "Ctrl", alt: "Alt", shift: "Shift" };

function parse(shortcut: string) {
  const parts = shortcut
    .toLowerCase()
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  const modifiers = parts.filter((p): p is Modifier => MODIFIERS.includes(p as Modifier));
  const key = parts.find((p) => !MODIFIERS.includes(p as Modifier)) ?? "k";
  return { modifiers, key };
}

// Physical key too: Option on a Mac changes event.key (Option+K types "˚").
const isKey = (e: KeyboardEvent, key: string) =>
  e.key.toLowerCase() === key || e.code === `Key${key.toUpperCase()}` || e.code === `Digit${key}`;

const noSubscribe = () => () => {};
function readIsMac() {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform ?? navigator.platform);
}

function isDown(m: Modifier, e: KeyboardEvent, mac: boolean) {
  if (m === "mod") return mac ? e.metaKey : e.ctrlKey;
  if (m === "ctrl") return e.ctrlKey;
  if (m === "alt") return e.altKey;
  return e.shiftKey;
}

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/** Sets a React-controlled input's value and fires the input event React listens for. */
function clearInput(field: HTMLInputElement) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(field, "");
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function Key({ label, on = false }: { label: string; on?: boolean }) {
  return (
    <kbd
      data-on={on || undefined}
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-foreground/[0.07] px-1.5 font-sans text-[11px] font-medium leading-none text-muted-foreground transition-colors duration-150 data-[on]:bg-foreground/[0.18] data-[on]:text-foreground data-[on]:duration-75"
    >
      {label}
    </kbd>
  );
}

export interface CommandSearchProps {
  /** The real search field. It fills the opened pill. */
  children: React.ReactNode;
  /** Short word shown on the folded pill, e.g. "Search" / "搜索". */
  label: React.ReactNode;
  /** True while the field holds text; the pill never folds over a query. */
  hasValue: boolean;
  /** `+`-joined: `mod` (⌘ on Mac, Ctrl elsewhere), `ctrl`, `alt`, `shift`, one key. One per page. */
  shortcut?: string;
  /** Height class shared by the pill and the field, e.g. "h-10". */
  heightClassName?: string;
  /** How springy the open is, 0 to 100. */
  bounce?: number;
  /** The box the field opens into (width classes go here). */
  className?: string;
  pillClassName?: string;
}

export function CommandSearch({
  children,
  label,
  hasValue,
  shortcut,
  heightClassName = "h-10",
  bounce = 0,
  className,
  pillClassName,
}: CommandSearchProps) {
  const root = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const mac = React.useSyncExternalStore(noSubscribe, readIsMac, () => null);
  const [focused, setFocused] = React.useState(false);
  const [animating, setAnimating] = React.useState(false);
  const [held, setHeld] = React.useState<{ mods: Modifier[]; key: boolean }>({
    mods: [],
    key: false,
  });
  const open = hasValue || focused;

  const pressTarget = useMotionValue(1);
  const scale = useSpring(pressTarget, PRESS);
  const press = React.useCallback(
    (down: boolean) => pressTarget.set(down && !reduce ? 0.97 : 1),
    [pressTarget, reduce],
  );

  const field = () => root.current?.querySelector<HTMLInputElement>("input") ?? null;
  const focusField = () => field()?.focus({ preventScroll: true });

  const parsed = shortcut ? parse(shortcut) : null;
  const live = React.useRef({ parsed, open });
  React.useLayoutEffect(() => {
    live.current = { parsed, open };
  });

  React.useEffect(() => {
    if (mac === null || !shortcut) return;
    const visible = () => !!root.current && root.current.getClientRects().length > 0;
    const sync = (e: KeyboardEvent, down: boolean) => {
      const p = live.current.parsed;
      if (!p) return;
      const next = {
        mods: p.modifiers.filter((m) => isDown(m, e, mac)),
        key: down && isKey(e, p.key),
      };
      setHeld((cur) => (cur.key === next.key && cur.mods.join() === next.mods.join() ? cur : next));
      press(next.key || next.mods.length > 0);
    };
    const onDown = (e: KeyboardEvent) => {
      const { parsed: p, open: isOpen } = live.current;
      if (!p || isOpen || !visible()) return;
      if (!p.modifiers.some((m) => m !== "shift") && typing(e.target)) return;
      sync(e, true);
      if (!e.repeat && p.modifiers.every((m) => isDown(m, e, mac)) && isKey(e, p.key)) {
        e.preventDefault();
        root.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
      }
    };
    const onUp = (e: KeyboardEvent) => sync(e, false);
    const release = () => {
      setHeld({ mods: [], key: false });
      press(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", release);
    };
  }, [mac, shortcut, press]);

  // A page may focus the field on mount (after this effect runs), so check a frame later.
  React.useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (root.current?.contains(document.activeElement)) setFocused(true);
    });
    // Blur events can be missed (window not focused, focus moved by script), so also
    // resync on any focus change or press elsewhere on the page.
    const sync = () => setFocused(!!root.current?.contains(document.activeElement));
    const away = (e: Event) => {
      if (!root.current?.contains(e.target as Node)) requestAnimationFrame(sync);
    };
    document.addEventListener("focusin", sync);
    document.addEventListener("pointerdown", away);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("focusin", sync);
      document.removeEventListener("pointerdown", away);
    };
  }, []);

  const labels = mac === false ? PC : MAC;
  const swapIn = { opacity: 1, filter: "blur(0px)", transition: { ...SWAP, delay: 0.06 } };
  const swapOut = { opacity: 0, filter: "blur(4px)", transition: SWAP };

  return (
    <div
      ref={root}
      data-open={open || undefined}
      className={cn("relative min-w-0", className)}
      onFocusCapture={() => {
        setFocused(true);
        press(false);
      }}
      onBlurCapture={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDownCapture={(event) => {
        if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
        const input = field();
        if (!input || event.target !== input) return;
        if (input.value) clearInput(input);
        else input.blur();
      }}
    >
      <motion.div
        layout
        transition={{ layout: reduce ? { duration: 0 } : openSpring(bounce) }}
        onLayoutAnimationStart={() => setAnimating(true)}
        onLayoutAnimationComplete={() => setAnimating(false)}
        style={{ scale, borderRadius: 999, width: open ? "100%" : "fit-content" }}
        onPointerDown={() => !open && press(true)}
        onPointerUp={() => press(false)}
        onPointerLeave={() => press(false)}
        className={cn(
          "relative max-w-full",
          !open && heightClassName,
          (!open || animating) && "overflow-hidden",
          !open && "bg-foreground/[0.06] transition-colors duration-150 hover:bg-foreground/[0.09]",
          pillClassName,
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {!open && (
            <motion.button
              key="pill"
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={focusField}
              className={cn(
                "flex cursor-pointer select-none items-center gap-2 whitespace-nowrap pl-3.5 pr-2.5 text-sm font-medium text-muted-foreground outline-none",
                heightClassName,
                !parsed && "pr-4",
              )}
              initial={{ opacity: 0, filter: "blur(4px)" }}
              animate={swapIn}
              exit={swapOut}
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
              {parsed && (
                <span
                  className={cn(
                    "ml-1 flex items-center gap-1 transition-opacity duration-200",
                    mac === null && "opacity-0",
                  )}
                >
                  {parsed.modifiers.map((m) => (
                    <Key key={m} label={labels[m]} on={held.mods.includes(m)} />
                  ))}
                  <Key
                    label={parsed.key.length === 1 ? parsed.key.toUpperCase() : parsed.key}
                    on={held.key}
                  />
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
        <motion.div
          layout
          initial={false}
          animate={open ? swapIn : swapOut}
          className={cn("w-full", open ? "relative" : "pointer-events-none absolute inset-0")}
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}
