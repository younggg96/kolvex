"use client";

import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/theme/ThemeToggle";
import LogoIcon from "@/components/common/LogoIcon";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth, useUserProfile } from "@/hooks";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/lib/i18n";
import { useCopy } from "@/components/decision/shared";
import { landingNavigation } from "@/components/landing/landingNavigation";

export default function LandingHeader() {
  const { t, locale, setLocale } = useTranslation();
  const c = useCopy();
  const { theme } = useTheme();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { profile } = useUserProfile();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const isAuthRoute = pathname === "/auth";
  const [navigationOpen, setNavigationOpen] = useState(false);

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
          <span className={`${textColorClass} text-xl font-extrabold`}>
            Kolvex
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-4">
          <DropdownMenu open={navigationOpen} onOpenChange={setNavigationOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="min-h-10 gap-2 px-2 sm:px-3" aria-label={c("Navigation", "导航")}>
                <Menu size={18} aria-hidden="true" />
                <span className="hidden sm:inline">{c("Navigation", "导航")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={12}>
              {landingNavigation.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href} className="min-h-11 justify-between gap-8"
                    onClick={() => setNavigationOpen(false)}
                  >
                    {c(item.label[0], item.label[1])}<ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
                    title={c("Open workspace", "打开工作台")}
                    aria-label={c("Open workspace", "打开工作台")}
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
                    className="landing-sign-in rounded-full px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    {t("landing.nav.signIn")}
                  </Link>
                )
              )}
            </>
          )}
          {!isAuthRoute && (
            <Button asChild className="landing-nav-cta">
              <Link href={isAuthenticated ? "/dashboard" : "/auth"}>
                {isAuthenticated
                  ? c("Open workspace", "打开工作台")
                  : c("Get started", "开始使用")}
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
            aria-label={locale === "zh" ? "Switch to English" : "切换为中文"}
            className="text-xs font-semibold"
          >
            {locale === "zh" ? "EN" : "中"}
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
