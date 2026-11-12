"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const WayglimBackground = dynamic(() => import("./WayglimBackground"), {
  ssr: false,
});

const STATIC_DEVICE = "(max-width: 767px), (pointer: coarse)";

export default function SiteBackground() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [staticDevice, setStaticDevice] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia(STATIC_DEVICE);
    const update = () => setStaticDevice(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (resolvedTheme !== "light" || staticDevice === null) return null;

  const isHome = pathname === "/";

  return (
    <div
      aria-hidden="true"
      className="site-background"
      data-home={isHome || undefined}
      data-still={staticDevice || undefined}
    >
      {!staticDevice && (
        <WayglimBackground
          paused={!isHome}
          style={{ backgroundColor: "transparent" }}
        />
      )}
    </div>
  );
}
