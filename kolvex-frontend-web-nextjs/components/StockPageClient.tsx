"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import HotStocksList from "./TrendingStocksList";
import TrackedStocksTable from "@/components/TrackedStocksTable";
import StockSearchDialog from "@/components/StockSearchDialog";
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

  return (
    <DashboardLayout title="Stock Tracker">
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-2 p-2 overflow-hidden">
        {/* Left Column - Trending Stocks */}
        <div className="xl:col-span-2">
          <HotStocksList
            fetchFromApi={true}
            enableInfiniteScroll={true}
            title="Trending Stocks"
          />
        </div>

        {/* Right Column - My Watchlist */}
        <div className="space-y-2 xl:row-span-2">
          <TrackedStocksTable
            onAddClick={openAddDialog}
            stocks={stocks}
            onUpdate={loadStocks}
            loading={isLoading}
          />
        </div>
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
