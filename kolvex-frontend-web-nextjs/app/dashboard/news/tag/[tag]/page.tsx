import type { Metadata } from "next";
import NewsTagPageClient from "./NewsTagPageClient";

// 生成动态元数据
export async function generateMetadata({
  params,
}: {
  params: { tag: string };
}): Promise<Metadata> {
  const tag = decodeURIComponent(params.tag);
  
  return {
    title: `#${tag} News - Kolvex`,
    description: `Browse all news articles tagged with #${tag}`,
  };
}

interface NewsTagPageProps {
  params: {
    tag: string;
  };
}

// 服务器组件
export default function NewsTagPage({ params }: NewsTagPageProps) {
  const tag = decodeURIComponent(params.tag);

  return <NewsTagPageClient tag={tag} />;
}

