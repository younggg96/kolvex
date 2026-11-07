"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/** Where the phone header's back button goes: a link or an in-page action. */
export type HeaderBackTarget = { label: string; href?: string; onClick?: () => void };

type Register = (target: HeaderBackTarget | null) => void;
const HeaderBackContext = createContext<Register | null>(null);

/**
 * Provided by DashboardLayout only while the floating phone header is shown.
 * A breadcrumb inside it hands over its parent so the header can render the
 * back button beside the source tabs instead of a separate breadcrumb row.
 */
export function useHeaderBackState() {
  const action = useRef<(() => void) | undefined>(undefined);
  const [target, setTarget] = useState<{ label: string; href?: string; action: boolean } | null>(null);
  const register = useCallback<Register>((next) => {
    action.current = next?.onClick;
    // Compare by value: callers rebuild the item every render.
    setTarget(previous => {
      if (!next) return null;
      const value = { label: next.label, href: next.href, action: Boolean(next.onClick) };
      return previous && previous.label === value.label && previous.href === value.href && previous.action === value.action ? previous : value;
    });
  }, []);
  const back = target && { label: target.label, href: target.href, onClick: target.action ? () => action.current?.() : undefined };
  return { back, register };
}

export function HeaderBackProvider({ register, children }: { register: Register | null; children: ReactNode }) {
  return <HeaderBackContext.Provider value={register}>{children}</HeaderBackContext.Provider>;
}

/** Publishes the breadcrumb's parent to the header. Returns true when a header took it. */
export function useRegisterHeaderBack(target: HeaderBackTarget | undefined) {
  const register = useContext(HeaderBackContext);
  useEffect(() => {
    if (!register) return;
    register(target ?? null);
  });
  useEffect(() => () => register?.(null), [register]);
  return Boolean(register);
}
