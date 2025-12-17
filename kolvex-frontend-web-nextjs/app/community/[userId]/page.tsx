import { Metadata } from "next";
import { PublicPortfolioPageClient } from "./PublicPortfolioPageClient";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export const metadata: Metadata = {
  title: "Community Portfolio | Kolvex",
  description: "View a community portfolio",
  openGraph: {
    title: "Community Portfolio | Kolvex",
    description: "View a community portfolio",
    type: "website",
  },
  twitter: {
    title: "Community Portfolio | Kolvex",
    description: "View a community portfolio",
  },
};

export default async function PublicPortfolioPage({ params }: PageProps) {
  const { userId } = await params;
  return <PublicPortfolioPageClient userId={userId} />;
}
