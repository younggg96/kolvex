import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Social Media - Kolvex",
  description: "Social media analytics and insights",
};

export default function SocialPage() {
  // 默认重定向到 Twitter 页面
  redirect("/dashboard/social/twitter");
}









