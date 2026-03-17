import { Metadata } from "next";
import YouTubePageClient from "./YouTubePageClient";

export const metadata: Metadata = {
  title: "YouTube - Social Media - Kolvex",
  description: "YouTube videos and analytics from financial influencers",
};

export default function YouTubePage() {
  return <YouTubePageClient />;
}
