import { notFound } from "next/navigation";
import NewsPageClient from "@/components/news/NewsPageClient";
import type { Metadata } from "next";

// 定义有效的分类
const validCategories = ["market"];

// 生成静态参数（可选：用于静态生成）
export async function generateStaticParams() {
  return validCategories.map((category) => ({
    category,
  }));
}

// 生成动态元数据
export async function generateMetadata({
  params,
}: {
  params: { category: string };
}): Promise<Metadata> {
  const category = params.category;
  
  const titles: Record<string, string> = {
    market: "Market News - Kolvex",
  };

  const descriptions: Record<string, string> = {
    market: "Stay updated with the latest market news and trends",
  };

  return {
    title: titles[category] || "News - Kolvex",
    description: descriptions[category] || "Stay informed about the market",
  };
}

interface NewsPageProps {
  params: {
    category: string;
  };
}

// 服务器组件
export default function NewsPage({ params }: NewsPageProps) {
  const { category } = params;

  // 验证分类是否有效
  if (!validCategories.includes(category)) {
    notFound();
  }

  // 服务器端渲染：传递参数给客户端组件
  return <NewsPageClient category={category} />;
}
