"use client";

/**
 * Command search: wraps a search field with a page-wide shortcut.
 *
 * Adapted from "Command button" by DesignBookmark (designbookmark.com/motion, MIT).
 * The field never folds; from the original it keeps the shortcut, the key chips
 * that light while held (shown in the empty, idle field), and Esc: clear first,
 * then leave the field. Chips fade with the original 0.18s blur swap.
 * Colours come from theme tokens, never hex.
 */

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

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
  /** The real search field. */
  children: React.ReactNode;
  /** True while the field holds text; hides the shortcut hint. */
  hasValue: boolean;
  /** `+`-joined: `mod` (⌘ on Mac, Ctrl elsewhere), `ctrl`, `alt`, `shift`, one key. One per page. */
  shortcut?: string;
  className?: string;
}

export function CommandSearch({ children, hasValue, shortcut, className }: CommandSearchProps) {
  const root = React.useRef<HTMLDivElement>(null);
  const mac = React.useSyncExternalStore(noSubscribe, readIsMac, () => null);
  const [focused, setFocused] = React.useState(false);
  const [held, setHeld] = React.useState<{ mods: Modifier[]; key: boolean }>({
    mods: [],
    key: false,
  });

  const field = () => root.current?.querySelector<HTMLInputElement>("input") ?? null;
  const parsed = shortcut ? parse(shortcut) : null;
  const live = React.useRef(parsed);
  React.useLayoutEffect(() => {
    live.current = parsed;
  });

  // Focus can change without a blur event reaching us (window not focused, focus
  // moved by script), so resync on any focus change on the page.
  React.useEffect(() => {
    const sync = () => setFocused(!!root.current?.contains(document.activeElement));
    const id = requestAnimationFrame(sync);
    document.addEventListener("focusin", sync);
    const later = () => requestAnimationFrame(sync);
    document.addEventListener("focusout", later);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("focusin", sync);
      document.removeEventListener("focusout", later);
    };
  }, []);

  React.useEffect(() => {
    if (mac === null || !shortcut) return;
    const visible = () => !!root.current && root.current.getClientRects().length > 0;
    const sync = (e: KeyboardEvent, down: boolean) => {
      const p = live.current;
      if (!p) return;
      const next = {
        mods: p.modifiers.filter((m) => isDown(m, e, mac)),
        key: down && isKey(e, p.key),
      };
      setHeld((cur) => (cur.key === next.key && cur.mods.join() === next.mods.join() ? cur : next));
    };
    const onDown = (e: KeyboardEvent) => {
      const p = live.current;
      if (!p || !visible() || root.current?.contains(document.activeElement)) return;
      if (!p.modifiers.some((m) => m !== "shift") && typing(e.target)) return;
      sync(e, true);
      if (!e.repeat && p.modifiers.every((m) => isDown(m, e, mac)) && isKey(e, p.key)) {
        e.preventDefault();
        root.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
      }
    };
    const onUp = (e: KeyboardEvent) => sync(e, false);
    const release = () => setHeld({ mods: [], key: false });
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", release);
    };
  }, [mac, shortcut]);

  const labels = mac === false ? PC : MAC;
  const showHint = !!parsed && mac !== null && !hasValue && !focused;

  return (
    <div
      ref={root}
      className={cn("relative min-w-0", className)}
      onKeyDownCapture={(event) => {
        if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
        const input = field();
        if (!input || event.target !== input) return;
        if (input.value) clearInput(input);
        else input.blur();
      }}
    >
      {children}
      <AnimatePresence initial={false}>
        {showHint && parsed && (
          <motion.span
            key="hint"
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 z-10 flex items-center gap-1"
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)", transition: { ...SWAP, delay: 0.06 } }}
            exit={{ opacity: 0, filter: "blur(4px)", transition: SWAP }}
          >
            {parsed.modifiers.map((m) => (
              <Key key={m} label={labels[m]} on={held.mods.includes(m)} />
            ))}
            <Key
              label={parsed.key.length === 1 ? parsed.key.toUpperCase() : parsed.key}
              on={held.key}
            />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
