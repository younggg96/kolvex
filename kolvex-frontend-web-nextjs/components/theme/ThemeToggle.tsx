"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, SunMoon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ThemeToggle({ labels }: { labels?: { light: string; dark: string } } = {}) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="glass-button glass-button-neutral w-9 h-9 rounded-full bg-foreground/[0.08] flex items-center justify-center">
        <SunMoon className="w-5 h-5 text-muted-foreground" />
      </div>
    );
  }

  const label = theme === "dark" ? labels?.light || "Switch to light mode" : labels?.dark || "Switch to dark mode";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title={label}
      aria-label={label}
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5 text-warning" />
      ) : (
        <Moon className="w-5 h-5 text-foreground" />
      )}
    </Button>
  );
}
