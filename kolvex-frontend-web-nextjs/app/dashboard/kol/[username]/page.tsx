import { Metadata } from "next";
import KOLProfilePageClient from "@/components/kol/KOLProfilePageClient";
import type { Platform } from "@/lib/supabase/database.types";

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

  const platformName = platform === "REDNOTE" ? "RedNote" : "Twitter";
  return {
    title: `@${username} - ${platformName} KOL Profile | Kolvex`,
    description: `View profile and posts from @${username} on ${platformName}`,
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
