"use client";

import { Toaster as Sonner } from "sonner";
import { useEffect, useState } from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only render on client to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position={"top-center"}
      toastOptions={{
        classNames: {
          toast: "group toast rounded-lg shadow-2xl border",
          description: "text-sm opacity-90",
          actionButton: "bg-white/20 text-white hover:bg-white/30",
          cancelButton: "bg-white/10 text-white hover:bg-white/20",
          success: "!bg-background !text-foreground !border-border",
          error: "!bg-background !text-negative !border-negative/30",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
