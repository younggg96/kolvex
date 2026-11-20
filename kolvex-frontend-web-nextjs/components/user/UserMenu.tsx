"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useAuth, useUserProfile } from "@/hooks";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const SETTINGS_HREF = "/dashboard/settings";

interface UserMenuProps {
  isCollapsed?: boolean;
  onNavigate?: () => void;
}

/**
 * Sidebar account card. It is the single desktop entry to Settings; admin and
 * sign-out live on the Settings page (which phones reach from the tab bar), so
 * the sidebar does not repeat them.
 */
export default function UserMenu({ isCollapsed = false, onNavigate }: UserMenuProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile } = useUserProfile();

  const displayName = profile?.full_name || "User";
  const displayEmail = user?.email || "";
  const active = pathname === SETTINGS_HREF || pathname.startsWith(`${SETTINGS_HREF}/`);
  const label = t("sidebar.settings");

  const initials = profile?.full_name
    ? profile.full_name.substring(0, 2).toUpperCase()
    : user?.email
      ? user.email.substring(0, 2).toUpperCase()
      : "U";

  return (
    <Link
      href={SETTINGS_HREF}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={isCollapsed ? label : undefined}
      title={isCollapsed ? label : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-full py-1.5 transition-colors hover:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:outline-primary",
        isCollapsed ? "justify-center" : "pl-1.5 pr-3",
        active && "bg-foreground/[0.06]",
      )}
    >
      <div className="relative flex-shrink-0">
        {profile?.avatar_url ? (
          <div className="relative h-8 w-8 overflow-hidden rounded-full">
            <Image src={profile.avatar_url} alt="" fill className="object-cover" sizes="32px" />
          </div>
        ) : (
          <div
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          >
            {initials}
          </div>
        )}
      </div>

      {!isCollapsed && (
        <>
          <div className="flex flex-1 flex-col overflow-hidden text-left">
            <span className="truncate text-sm font-semibold text-foreground">{displayName}</span>
            <span className="truncate text-xs text-muted-foreground">{displayEmail}</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </>
      )}
    </Link>
  );
}
