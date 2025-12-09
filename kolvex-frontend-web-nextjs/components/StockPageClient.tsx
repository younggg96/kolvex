"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import HotStocksList from "./TrendingStocksList";
import TrackedStocksTable from "@/components/TrackedStocksTable";
import StockSearchDialog from "@/components/StockSearchDialog";
import SectionCard from "@/components/SectionCard";
import { SwitchTab } from "@/components/ui/switch-tab";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, Star } from "lucide-react";
import {
  TrackedStock,
  createTrackedStock,
  deleteTrackedStock,
} from "@/lib/trackedStockApi";
import { toast } from "sonner";

export default function StockPageClient() {
  const [stocks, setStocks] = useState<TrackedStock[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("trending");

  // Load stocks on mount
  useEffect(() => {
    loadStocks();
  }, []);

  // Reload stocks
  const loadStocks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/tracked-stocks");
      if (!response.ok) throw new Error("Failed to fetch stocks");
      const data = await response.json();
      setStocks(data);
    } catch (error) {
      console.error("Error loading stocks:", error);
      toast.error("Failed to load watchlist");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle stock selection from search dialog
  const handleStockSelect = async (stock: {
    symbol: string;
    name: string;
    logo?: string;
  }) => {
    try {
      await createTrackedStock({
        symbol: stock.symbol,
        companyName: stock.name,
        logo: stock.logo,
      });
      toast.success("Stock added successfully");
      setIsAddDialogOpen(false);
      loadStocks();
    } catch (error) {
      toast.error("Failed to add stock");
      console.error(error);
    }
  };

  const openAddDialog = () => {
    setIsAddDialogOpen(true);
  };

  // Handle delete stock
  const handleDeleteStock = async (stockId: string) => {
    try {
      await deleteTrackedStock(stockId);
      toast.success("Stock deleted successfully");
      loadStocks();
    } catch (error) {
      console.error("Error deleting stock:", error);
      toast.error("Failed to delete stock");
    }
  };

  const tabOptions = [
    {
      value: "trending",
      label: "Trending",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
    },
    {
      value: "watchlist",
      label: "Watchlist",
      icon: <Star className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <DashboardLayout title="Stocks">
      <div className="flex-1 p-2 overflow-hidden">
        <SectionCard
          useSectionHeader={false}
          padding="md"
          className="h-full flex flex-col"
          contentClassName="flex-1 overflow-hidden flex flex-col"
        >
          {/* Header with Tabs and Add Button */}
          <div className="flex items-center justify-between gap-4 px-4 pt-4 pb-3">
            <SwitchTab
              options={tabOptions}
              value={activeTab}
              onValueChange={setActiveTab}
              size="md"
              variant="pills"
              className="!w-fit"
            />
            {activeTab === "watchlist" && (
              <Button onClick={openAddDialog} size="sm" variant="ghost">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden px-4 pb-4">
            {activeTab === "trending" ? (
              <HotStocksList
                fetchFromApi={true}
                enableInfiniteScroll={true}
                withCard={false}
                maxHeight="calc(100vh - 200px)"
              />
            ) : (
              <TrackedStocksTable
                stocks={stocks}
                onUpdate={loadStocks}
                loading={isLoading}
                withCard={false}
              />
            )}
          </div>
        </SectionCard>
      </div>

      {/* Stock Search Dialog */}
      <StockSearchDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSelect={handleStockSelect}
        trackedStocks={stocks}
        onDelete={handleDeleteStock}
      />
    </DashboardLayout>
  );
}
