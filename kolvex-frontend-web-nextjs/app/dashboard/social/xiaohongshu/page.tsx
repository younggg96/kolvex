import { Metadata } from "next";
import XiaohongshuPageClient from "./XiaohongshuPageClient";

export const metadata: Metadata = {
  title: "Xiaohongshu - Kolvex",
  description: "Xiaohongshu posts and analytics from KOLs",
};

export default function XiaohongshuPage() {
  return <XiaohongshuPageClient />;
}
