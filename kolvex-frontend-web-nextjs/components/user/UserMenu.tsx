"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronDown, User, Bell, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, useUserProfile } from "@/hooks";
import { useTranslation } from "@/lib/i18n";

interface UserMenuProps {
  isCollapsed?: boolean;
}

export default function UserMenu({ isCollapsed = false }: UserMenuProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile();

  // Get display name (full name or email)
  const displayName = profile?.full_name || "User";
  const displayEmail = user?.email || "";

  // Get initials for avatar
  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/auth");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex w-full items-center gap-2.5 rounded-full py-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            isCollapsed ? "justify-center" : "pl-1.5 pr-3"
          }`}
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {profile?.avatar_url ? (
              <div className="relative h-8 w-8 overflow-hidden rounded-full">
                <Image
                  src={profile.avatar_url}
                  alt="Profile"
                  fill
                  className="object-cover"
                  sizes="32px"
                />
              </div>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {getInitials()}
              </div>
            )}
          </div>

          {/* User Details */}
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden text-left flex-1">
              <span className="truncate text-sm font-semibold text-foreground">
                {displayName}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {displayEmail}
              </span>
            </div>
          )}

          {/* Dropdown Icon */}
          {!isCollapsed && (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={"start"} className="w-48">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-0.5">
            <p className="text-sm font-semibold text-foreground">
              {displayName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {displayEmail}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => router.push("/dashboard/settings?tab=account")}
        >
          <User className="h-4 w-4" />
          <span>{t("userMenu.account")}</span>
        </DropdownMenuItem>


        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          className="text-negative hover:text-negative focus:text-negative"
        >
          <LogOut className="h-4 w-4" />
          <span>{t("userMenu.logOut")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
