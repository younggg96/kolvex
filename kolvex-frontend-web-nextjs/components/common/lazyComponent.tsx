"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";

/**
 * Splits a heavy client component (charts) out of the route's first-load JS. The chunk
 * is fetched after hydration; until then `fallback` renders with the same props so it
 * can reserve the final size and the page does not shift.
 */
export function lazyComponent<P extends object>(
  load: () => Promise<ComponentType<P>>,
  fallback: (props: P) => ReactNode,
) {
  let loaded: ComponentType<P> | null = null;
  let request: Promise<ComponentType<P>> | null = null;

  function LazyComponent(props: P) {
    const [Component, setComponent] = useState<ComponentType<P> | null>(() => loaded);

    useEffect(() => {
      if (Component) return;
      let active = true;
      request ??= load().then(
        (component) => (loaded = component),
        (error) => {
          request = null; // Let the next mount retry a failed chunk download.
          throw error;
        },
      );
      request.then(
        (component) => active && setComponent(() => component),
        () => undefined,
      );
      return () => {
        active = false;
      };
    }, [Component]);

    return Component ? <Component {...props} /> : <>{fallback(props)}</>;
  }

  return LazyComponent;
}
