import { Metadata } from "next";
import TwitterPageClient from "./TwitterPageClient";

export const metadata: Metadata = {
  title: "X / Twitter - Social Media - Kolvex",
  description: "X / Twitter posts and analytics from KOLs",
};

export default function TwitterPage() {
  return <TwitterPageClient />;
}
