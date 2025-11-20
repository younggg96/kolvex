import { redirect } from "next/navigation";

export default function NewsRedirect() {
  // 重定向到默认的 market 分类
  redirect("/dashboard/news/market");
}