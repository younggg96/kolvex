"use client";

import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/theme/ThemeToggle";
import KolvexWordmark from "@/components/common/KolvexWordmark";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useUserProfile } from "@/hooks";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ArrowUpRight, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/lib/i18n";
import { useCopy } from "@/components/decision/shared";
import { landingNavigation } from "@/components/landing/landingNavigation";

export default function LandingHeader() {
  const { t, locale, setLocale } = useTranslation();
  const c = useCopy();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { profile } = useUserProfile();
  const router = useRouter();
  const pathname = usePathname();
  const isAuthRoute = pathname === "/auth" || pathname.startsWith("/auth/");
  const [navigationOpen, setNavigationOpen] = useState(false);

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
    <header className="glass-header sticky top-0 z-40 border-b">
      <div className="landing-width flex min-h-[4.5rem] items-center justify-between gap-2 py-3 sm:gap-4">
        <Link href="/" className="group flex shrink-0 items-center gap-1.5 transition-all sm:gap-2">
          <KolvexWordmark
            height={20}
            className="transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none"
          />
        </Link>
        <div className="flex items-center gap-1 sm:gap-4">
          <DropdownMenu open={navigationOpen} onOpenChange={setNavigationOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="gap-2 sm:w-auto sm:px-3.5"
                aria-label={c("Navigation", "导航")}
              >
                <Menu size="1.125rem" aria-hidden="true" />
                <span className="hidden sm:inline">{c("Navigation", "导航")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={12}>
              {landingNavigation.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link
                    href={item.href}
                    className="min-h-11 justify-between gap-8"
                    onClick={() => setNavigationOpen(false)}
                  >
                    {c(item.label[0], item.label[1])}
                    <ArrowUpRight size="0.9375rem" aria-hidden="true" />
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
                      <div className="relative w-6 h-6 rounded-full overflow-hidden transition-all">
                        <Image
                          src={profile.avatar_url}
                          alt={t("settings.account.profileImage")}
                          fill
                          className="object-cover"
                          sizes="24px"
                        />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold transition-all">
                        {getInitials()}
                      </div>
                    )}
                  </Button>
                </>
              ) : (
                !isAuthRoute && (
                  <Link
                    href="/auth"
                    className="hidden whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.06] hover:text-foreground sm:inline"
                  >
                    {t("landing.nav.signIn")}
                  </Link>
                )
              )}
            </>
          )}
          {!isAuthRoute && (
            <Button
              asChild
              className="max-sm:px-2.5 [.landing-page_&]:px-5 [.landing-page_&]:text-[0.8125rem] max-[641px]:[.landing-page_&]:hidden"
            >
              <Link href={isAuthenticated ? "/dashboard" : "/auth"}>
                {isAuthenticated ? (
                  <>
                    <span className="sm:hidden">{c("Workspace", "工作台")}</span>
                    <span className="hidden sm:inline">{c("Open workspace", "打开工作台")}</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">{t("landing.nav.signIn")}</span>
                    <span className="hidden sm:inline">{c("Get started", "开始使用")}</span>
                  </>
                )}
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
            aria-label={locale === "zh" ? "Switch to English" : "切换为中文"}
            className="w-auto min-w-9 px-2 text-xs font-semibold"
          >
            <span lang={locale === "zh" ? "en" : "zh-CN"}>
              {locale === "zh" ? "English" : "中文"}
            </span>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
