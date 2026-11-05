"use client";

import { ReactNode, useEffect } from "react";
import BaseLayout from "@/components/layout/BaseLayout";
import WaylumeBackground from "@/components/auth/WaylumeBackground";
import "./auth.css";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export default function AuthLayout({
  children,
  title,
  subtitle,
}: AuthLayoutProps) {
  useEffect(() => {
    document.title = `${title} | Kolvex`;
  }, [title]);
  return (
    // The artwork is always black, so tokens resolve to the dark theme here.
    <div className="auth-page dark relative isolate min-h-screen text-foreground">
      <WaylumeBackground style={{ position: "fixed" }} />
      <BaseLayout hasFooter={false}>
        <div className="relative flex flex-1 items-start justify-center px-4 py-10 sm:py-12">
          <section
            className="w-full max-w-[27.5rem] rounded-3xl border border-foreground/10 glass-card glass-card-blur bg-card-glass p-6 sm:p-8"
            aria-labelledby="auth-title"
          >
            <div className="mb-7">
              <h1
                id="auth-title"
                className="text-3xl font-semibold leading-tight tracking-tight text-foreground"
              >
                {title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {subtitle}
              </p>
            </div>
            {children}
          </section>
        </div>
      </BaseLayout>
    </div>
  );
}
