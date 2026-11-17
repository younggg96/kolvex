import { notFound, permanentRedirect } from "next/navigation";
import { getPublicResearchList } from "@/lib/publicContent";
import { PUBLIC_PAGE_SIZE, publicPage, publicPagePath } from "@/lib/publicRoutes";
import { readingMetadata } from "@/lib/publicSeo";
import {
  ReadingHeading,
  ReadingText,
  ReadingPagination,
  ReadingSectionHeading,
  ResearchList,
} from "@/components/public/ReadingElements";

// Also served as `/research/page/[page]`, which passes the page number in params.
type Props = { params: { page?: string } };

export async function generateMetadata({ params }: Props) {
  const page = publicPage(params.page);
  if (!page) notFound();
  if (params.page === "1") permanentRedirect("/research");
  const data = await getPublicResearchList((page - 1) * PUBLIC_PAGE_SIZE);
  if (page > 1 && (page - 1) * PUBLIC_PAGE_SIZE >= data.total) notFound();
  return readingMetadata(
    `AI 股票研究报告${page > 1 ? ` — 第 ${page} 页` : ""} | Kolvex`,
    "免费阅读已发布的美股 AI 研究报告，查看研究日期、市场与基本面证据、投资计划和多方讨论，无需登录。",
    publicPagePath("/research", page),
  );
}

export default async function ResearchPage({ params }: Props) {
  const page = publicPage(params.page);
  if (!page) notFound();
  if (params.page === "1") permanentRedirect("/research");
  const data = await getPublicResearchList((page - 1) * PUBLIC_PAGE_SIZE);
  if (page > 1 && (page - 1) * PUBLIC_PAGE_SIZE >= data.total) notFound();
  return (
    <>
      <ReadingHeading title={<ReadingText en="Stock research" zh="股票研究" />} />
      <ReadingSectionHeading
        title={<ReadingText en="Published reports" zh="已发布研究" />}
        count={data.total}
      />
      {data.items.length ? (
        <ResearchList items={data.items} />
      ) : (
        <p className="py-12 text-muted-foreground">
          <ReadingText
            en="No research reports have been published yet."
            zh="暂时没有已发布的研究报告。"
          />
        </p>
      )}
      <ReadingPagination page={page} total={data.total} size={PUBLIC_PAGE_SIZE} path="/research" />
    </>
  );
}
