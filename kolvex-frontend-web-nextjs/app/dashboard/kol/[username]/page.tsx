import { Metadata } from "next";
import KOLProfilePageClient from "@/components/KOLProfilePageClient";

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username} - KOL Profile | Kolvex`,
    description: `View profile and tweets from @${username}`,
  };
}

export default async function KOLProfilePage({ params }: PageProps) {
  const { username } = await params;
  return <KOLProfilePageClient username={username} />;
}

