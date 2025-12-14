"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getStockDiscussions,
  getStockNews,
  StockDiscussionsResponse,
  NewsListResponse,
} from "@/lib/kolTweetsApi";
import { SwitchTab } from "@/components/ui/switch-tab";
import SectionCard from "@/components/layout/SectionCard";
import { MessageSquare, Newspaper } from "lucide-react";
import { DiscussionsTabContent, NewsTabContent } from "./discussions";

interface StockDiscussionsProps {
  ticker: string;
}

export default function StockInfoBoard({ ticker }: StockDiscussionsProps) {
  const [data, setData] = useState<StockDiscussionsResponse | null>(null);
  const [newsData, setNewsData] = useState<NewsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newsLoadingMore, setNewsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [newsPage, setNewsPage] = useState(1);
  const [activeTab, setActiveTab] = useState("discussions");
  const pageSize = 10;

  const fetchData = useCallback(
    async (pageNum: number, append: boolean = false) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const result = await getStockDiscussions(ticker, {
          page: pageNum,
          page_size: pageSize,
          sort_by: "created_at",
          sort_direction: "desc",
        });

        if (append && data) {
          setData({
            ...result,
            tweets: [...data.tweets, ...result.tweets],
          });
        } else {
          setData(result);
        }
        setPage(pageNum);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [ticker, data]
  );

  const fetchNewsData = useCallback(
    async (pageNum: number, append: boolean = false) => {
      try {
        if (append) {
          setNewsLoadingMore(true);
        } else {
          setNewsLoading(true);
        }
        setNewsError(null);

        const result = await getStockNews({
          page: pageNum,
          page_size: pageSize,
          ticker: ticker,
        });

        if (append && newsData) {
          setNewsData({
            ...result,
            articles: [...newsData.articles, ...result.articles],
          });
        } else {
          setNewsData(result);
        }
        setNewsPage(pageNum);
      } catch (err) {
        setNewsError(
          err instanceof Error ? err.message : "Failed to load news"
        );
      } finally {
        setNewsLoading(false);
        setNewsLoadingMore(false);
      }
    },
    [ticker, newsData]
  );

  useEffect(() => {
    fetchData(1);
  }, [ticker]);

  // 当切换到新闻tab时加载新闻数据
  useEffect(() => {
    if (activeTab === "news" && !newsData && !newsLoading) {
      fetchNewsData(1);
    }
  }, [activeTab, newsData, newsLoading, fetchNewsData]);

  const loadMore = () => {
    fetchData(page + 1, true);
  };

  const loadMoreNews = () => {
    fetchNewsData(newsPage + 1, true);
  };

  const tabOptions = [
    {
      value: "discussions",
      label: "Discussions",
      icon: <MessageSquare className="w-3.5 h-3.5" />,
    },
    {
      value: "news",
      label: "News",
      icon: <Newspaper className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <SectionCard useSectionHeader={false} padding="none" contentClassName="p-3">
      {/* Switch Tab */}
      <SwitchTab
        options={tabOptions}
        value={activeTab}
        onValueChange={setActiveTab}
        size="md"
        variant="pills"
        className="mb-2 !w-fit"
      />

      {/* Discussions Tab Content */}
      {activeTab === "discussions" && (
        <DiscussionsTabContent
          data={data}
          loading={loading}
          loadingMore={loadingMore}
          error={error}
          onLoadMore={loadMore}
          onRetry={() => fetchData(1)}
        />
      )}

      {/* News Tab Content */}
      {activeTab === "news" && (
        <NewsTabContent
          ticker={ticker}
          newsData={newsData}
          newsLoading={newsLoading}
          newsLoadingMore={newsLoadingMore}
          newsError={newsError}
          onLoadMore={loadMoreNews}
          onRetry={() => fetchNewsData(1)}
        />
      )}
    </SectionCard>
  );
}

// 重新导出骨架屏组件
export { StockDiscussionsSkeleton } from "./discussions";
