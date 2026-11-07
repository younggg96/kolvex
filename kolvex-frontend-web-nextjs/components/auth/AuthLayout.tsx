"use client";

import { ReactNode, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import BaseLayout from "@/components/layout/BaseLayout";
import WaylumeBackground from "@/components/auth/WaylumeBackground";
import { ContentLoading } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
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
  return <AuthFrame heading={<>
    <h1
      id="auth-title"
      className="text-3xl font-semibold leading-tight tracking-tight text-foreground"
    >
      {title}
    </h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">
      {subtitle}
    </p>
  </>}>{children}</AuthFrame>;
}

/** The sign-in card while the page or an OAuth return is still loading: same frame, form-shaped placeholders. */
export function AuthLayoutSkeleton({ label }: { label?: string }) {
  return <AuthFrame heading={<div aria-hidden="true"><Skeleton className="h-9 w-40 rounded-lg" /><Skeleton className="mt-4 h-4 w-56 rounded-md" /></div>}>
    <ContentLoading label={label} className="min-h-0 animate-none">
      <Skeleton className="mb-6 h-12 w-full rounded-full" />
      <div className="flex flex-col gap-5">
        {[0, 1].map((i) => <div key={i} className="flex flex-col gap-2"><Skeleton className="h-4 w-14 rounded-md" /><Skeleton className="h-12 w-full rounded-full" /></div>)}
        <Skeleton className="-mt-2 h-4 w-20 self-end rounded-md" />
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
      <div className="my-6 flex items-center gap-4"><div className="h-px flex-1 bg-border" /><Skeleton className="h-3 w-4 rounded" /><div className="h-px flex-1 bg-border" /></div>
      <Skeleton className="h-12 w-full rounded-full" />
    </ContentLoading>
  </AuthFrame>;
}

function AuthFrame({ heading, children }: { heading: ReactNode; children: ReactNode }) {

  // Phones get one still frame: the per-pixel shader at 60fps heats them up.
  const [freezeBackground, setFreezeBackground] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const update = () => setFreezeBackground(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // The artwork is always black, so it only plays in the dark theme; the light
  // theme keeps BaseLayout's own page fill and grid. Until the theme is known it
  // renders, matching the dark default without a flash.
  const { resolvedTheme } = useTheme();
  const showArtwork = resolvedTheme !== "light";

  return (
    <div className="auth-page relative isolate min-h-screen text-foreground" data-artwork={showArtwork || undefined}>
      {showArtwork && <WaylumeBackground paused={freezeBackground} style={{ position: "fixed" }} />}
      <BaseLayout hasFooter={false}>
        <div className="relative flex flex-1 items-start justify-center px-4 py-10 sm:py-12">
          <section
            className="w-full max-w-[27.5rem] rounded-3xl border border-foreground/10 glass-card glass-card-blur bg-card-glass p-6 sm:p-8"
            aria-labelledby="auth-title"
          >
            <div className="mb-7">{heading}</div>
            {children}
          </section>
        </div>
      </BaseLayout>
    </div>
  );
}
