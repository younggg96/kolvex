"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function Footer() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const textColorClass =
    mounted && theme === "dark"
      ? "text-white/50 hover:text-white"
      : "text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white";

  const copyrightColorClass =
    mounted && theme === "dark"
      ? "text-white/50"
      : "text-gray-600 dark:text-white/50";

  return (
    <footer className="relative z-10 w-full px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 text-xs sm:text-sm">
        <p className={`order-2 md:order-1 ${copyrightColorClass}`}>
          © 2025 Kolvex AI. All rights reserved.
        </p>
        <div className="flex items-center gap-4 sm:gap-6 order-1 md:order-2">
          <Link
            href="/terms"
            className={`transition-colors whitespace-nowrap ${textColorClass}`}
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy"
            className={`transition-colors whitespace-nowrap ${textColorClass}`}
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
