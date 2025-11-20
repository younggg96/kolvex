"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronDown,
  User,
  CreditCard,
  Bell,
  Settings,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, useUserProfile } from "@/hooks";

interface UserMenuProps {
  isCollapsed?: boolean;
}

export default function UserMenu({ isCollapsed = false }: UserMenuProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get display name (username or email)
  const displayName = profile?.username || user?.email?.split("@")[0] || "User";
  const displayEmail = user?.email || "";

  // Get initials for avatar
  const getInitials = () => {
    if (profile?.username) {
      return profile.username.substring(0, 2).toUpperCase();
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
          className={`flex items-center gap-2 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors w-full ${
            isCollapsed ? "justify-center" : "px-1.5"
          }`}
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {profile?.avatar_url ? (
              <div className="relative w-7 h-7 rounded-full overflow-hidden">
                <Image
                  src={profile.avatar_url}
                  alt="Profile"
                  fill
                  className="object-cover"
                  sizes="28px"
                />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold">
                {getInitials()}
              </div>
            )}
          </div>

          {/* User Details */}
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden text-left flex-1">
              <span className="text-gray-900 dark:text-white text-xs font-medium truncate">
                {displayName}
              </span>
              <span className="text-gray-600 dark:text-white/50 text-[10px] truncate">
                {displayEmail}
              </span>
            </div>
          )}

          {/* Dropdown Icon */}
          {!isCollapsed && (
            <ChevronDown className="w-3 h-3 text-gray-500 dark:text-white/50" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={"start"} className="w-48">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-0.5">
            <p className="text-xs font-medium text-gray-900 dark:text-white">
              {displayName}
            </p>
            <p className="text-[10px] text-gray-600 dark:text-white/50 truncate">
              {displayEmail}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => router.push("/dashboard/settings?tab=account")}
        >
          <User className="w-3 h-3" />
          <span>Account</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => router.push("/dashboard/settings?tab=billing")}
        >
          <CreditCard className="w-3 h-3" />
          <span>Billing</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => router.push("/dashboard/settings?tab=notifications")}
        >
          <Bell className="w-3 h-3" />
          <span>Notifications</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => {
            if (mounted) {
              setTheme(theme === "dark" ? "light" : "dark");
            }
          }}
        >
          {mounted && theme === "dark" ? (
            <Sun className="w-3 h-3" />
          ) : (
            <Moon className="w-3 h-3" />
          )}
          <span>
            {mounted
              ? theme === "dark"
                ? "Switch to Light Mode"
                : "Switch to Dark Mode"
              : "Theme"}
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
        >
          <LogOut className="w-3 h-3" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
