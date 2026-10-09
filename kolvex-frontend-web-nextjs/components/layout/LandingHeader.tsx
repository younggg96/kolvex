"use client";

import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/theme/ThemeToggle";
import UserMenu from "@/components/user/UserMenu";
import LogoIcon from "@/components/common/LogoIcon";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth, useUserProfile } from "@/hooks";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";

export default function LandingHeader() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { profile } = useUserProfile();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const isAuthRoute = usePathname() === "/auth";

  useEffect(() => {
    setMounted(true);
  }, []);

  const textColorClass =
    mounted && theme === "dark"
      ? "text-white"
      : "text-gray-900 dark:text-white";

  // Get initials for avatar fallback
  const getInitials = () => {
    if (profile?.username) {
      return profile.username.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const handleAvatarClick = () => {
    router.push("/dashboard");
  };

  return (
    <header className="relative z-10 border-b border-border bg-background">
      <div className="landing-width flex min-h-[72px] items-center justify-between gap-4 py-3">
      <Link
        href="/"
        className="flex items-center gap-1.5 sm:gap-2 group transition-all"
      >
        <LogoIcon
          size={24}
          className="h-7 w-7 text-primary transition-transform duration-200 group-hover:scale-110 motion-reduce:transform-none"
        />
        <span
          className={`${textColorClass} text-xl font-extrabold`}
        >
          Kolvex
        </span>
      </Link>
      <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label="Main navigation">
        <Link href="/#workflow" className="hover:text-foreground">{t("landing.nav.workflow")}</Link>
        <Link href="/dashboard/youtube-opinions" className="hover:text-foreground">{t("landing.nav.creatorResearch")}</Link>
        <Link href="/dashboard/ai-research" className="hover:text-foreground">{t("sidebar.tradingAnalysis")}</Link>
      </nav>
      <div className="flex items-center gap-3 sm:gap-4">
        {isLoading ? (
          // Loading state - use same Button structure to prevent layout shift
          <Button
            variant="ghost"
            size="icon"
            disabled
            className="flex items-center gap-2 cursor-default"
          >
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </Button>
        ) : (
          <>
            {isAuthenticated ? (
              <>
                {/* Mobile: Simple avatar button to go to dashboard */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleAvatarClick}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity dark:hover:!bg-transparent"
                  title="Go to Dashboard"
                >
                  {profile?.avatar_url ? (
                    <div className="relative w-6 h-6 rounded-full overflow-hidden ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
                      <Image
                        src={profile.avatar_url}
                        alt="Profile"
                        fill
                        className="object-cover"
                        sizes="24px"
                      />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
                      {getInitials()}
                    </div>
                  )}
                </Button>
              </>
            ) : (
              !isAuthRoute && (
                <Link
                  href="/auth"
                  className="rounded-full border border-primary px-5 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
                >
                  {t("landing.nav.signIn")}
                </Link>
              )
            )}
          </>
        )}
        <ThemeToggle />
      </div>
      </div>
    </header>
  );
}
