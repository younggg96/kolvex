import { Metadata } from "next";
import KOLProfilePageClient from "@/components/kol/KOLProfilePageClient";
import type { Platform } from "@/lib/supabase/database.types";
import { PLATFORM_CONFIG } from "@/lib/platformConfig";

interface PageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ platform?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { username } = await params;
  const { platform } = await searchParams;

  const platformName = PLATFORM_CONFIG[platform as Platform]?.name || "";
  const usernameDisplay =
    platform === "xiaohongshu" ? username.slice(0, 8) + "..." : username;

  return {
    title: `@${usernameDisplay} - ${platformName} KOL Profile | Kolvex`,
    description: `View profile and posts from @${usernameDisplay} on ${platformName}`,
  };
}

export default async function KOLProfilePage({
  params,
  searchParams,
}: PageProps) {
  const { username } = await params;
  const { platform } = await searchParams;

  return (
    <KOLProfilePageClient username={username} platform={platform as Platform} />
  );
}
