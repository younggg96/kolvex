import { notFound } from "next/navigation";
import { getPublicResearchList } from "@/lib/publicContent";
import { PUBLIC_PAGE_SIZE, publicPage, publicPagePath } from "@/lib/publicRoutes";
import { readingMetadata } from "@/lib/publicSeo";
import { ReadingHeading, ReadingPagination, ResearchList } from "@/components/public/ReadingElements";

type Props = { searchParams: { page?: string | string[] } };

export async function generateMetadata({ searchParams }: Props) {
  const page = publicPage(searchParams.page);
  if (!page) notFound();
  const data = await getPublicResearchList((page - 1) * PUBLIC_PAGE_SIZE);
  if (page > 1 && (page - 1) * PUBLIC_PAGE_SIZE >= data.total) notFound();
  return readingMetadata(`AI 股票研究报告${page > 1 ? ` — 第 ${page} 页` : ""} | Kolvex`, "免费阅读已发布的美股 AI 研究报告，查看研究日期、市场与基本面证据、投资计划和多方讨论，无需登录。", publicPagePath("/research", page));
}

export default async function ResearchPage({ searchParams }: Props) {
  const page = publicPage(searchParams.page);
  if (!page) notFound();
  const data = await getPublicResearchList((page - 1) * PUBLIC_PAGE_SIZE);
  if (page > 1 && (page - 1) * PUBLIC_PAGE_SIZE >= data.total) notFound();
  return <>
    <ReadingHeading title="股票研究">阅读已发布的 AI 研究报告。从结论回到证据，了解分析时点、不同观点与推理过程，无需登录。</ReadingHeading>
    {data.items.length ? <ResearchList items={data.items} /> : <p className="py-12 text-muted-foreground">暂时没有已发布的研究报告，发布后会在这里显示。</p>}
    <ReadingPagination page={page} total={data.total} size={PUBLIC_PAGE_SIZE} path="/research" />
  </>;
}
