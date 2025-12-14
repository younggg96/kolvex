"use client";

import React, { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SectionCard from "@/components/layout/SectionCard";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NewsCard } from "@/components/news";
import { getStockNews, NewsListResponse } from "@/lib/kolTweetsApi";
import { ChevronDown, AlertCircle, Newspaper, ArrowLeft } from "lucide-react";

interface NewsTagPageClientProps {
  tag: string;
}

export default function NewsTagPageClient({ tag }: NewsTagPageClientProps) {
  const [newsData, setNewsData] = useState<NewsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchNewsData = useCallback(
    async (pageNum: number, append: boolean = false) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const result = await getStockNews({
          page: pageNum,
          page_size: pageSize,
          tag: tag,
        });

        if (append && newsData) {
          setNewsData({
            ...result,
            articles: [...newsData.articles, ...result.articles],
          });
        } else {
          setNewsData(result);
        }
        setPage(pageNum);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load news");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tag, newsData]
  );

  useEffect(() => {
    fetchNewsData(1);
  }, [tag]);

  const loadMore = () => {
    fetchNewsData(page + 1, true);
  };

  const backButton = (
    <Button
      variant="ghost"
      size="icon"
      className="h-3.5 w-3.5 rounded-full mr-2"
      onClick={() => window.history.back()}
    >
      <ArrowLeft className="w-3.5 h-3.5" />
    </Button>
  );

  return (
    <DashboardLayout title={`#${tag} News`} headerLeftAction={backButton}>
      <div className="flex-1 p-2 overflow-y-auto">
        <div className="space-y-2">
          <SectionCard
            useSectionHeader={false}
            padding="sm"
            scrollable
            contentClassName="space-y-0 px-4 pb-4 !pt-0"
          >
            {/* Content */}
            {loading ? (
              <div className="space-y-3 py-4 animate-pulse">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex gap-3 p-3">
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-full" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex items-center justify-center gap-2 py-8 text-red-500">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            ) : !newsData || newsData.articles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Newspaper className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">No news available</p>
                <p className="text-xs mt-1">
                  No articles found with tag #{tag}
                </p>
              </div>
            ) : (
              <div>
                {/* News list */}
                <div className="space-y-1">
                  {newsData.articles.map((article, index) => (
                    <React.Fragment key={article.id || index}>
                      <NewsCard article={article} />
                      {index < newsData.articles.length - 1 && (
                        <Separator className="my-1" />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Load more */}
                {newsData.has_more && (
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="w-full"
                    >
                      {loadingMore ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span>Loading...</span>
                        </div>
                      ) : (
                        <>
                          Load More
                          <ChevronDown className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
