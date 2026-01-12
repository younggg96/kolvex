"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TrendingStocksTable from "@/components/trending-stocks";
import TrackingStocksTable from "@/components/tracking-stocks/TrackingStocksTable";
import StockSearchDialog from "@/components/stock/StockSearchDialog";
import { SwitchTab } from "@/components/ui/switch-tab";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, Star } from "lucide-react";
import { createTrackedStock } from "@/lib/trackedStockApi";
import { toast } from "sonner";
import { SearchInput } from "../ui/search-input";
import { StockHeroSection } from "./StockHeroSection";

export default function StockPageClient() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("trending");
  const [searchQuery, setSearchQuery] = useState("");

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
    } catch (error) {
      toast.error("Failed to add stock");
      console.error(error);
    }
  };

  const openAddDialog = () => {
    setIsAddDialogOpen(true);
  };

  const tabOptions = [
    {
      value: "trending",
      label: "Trending",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
    },
    {
      value: "tracking-stocks",
      label: "My Tracking",
      icon: <Star className="w-3.5 h-3.5" />,
    },
  ];

  // Header actions
  const headerActions = (
    <div className="flex items-center gap-2">
      <SwitchTab
        options={tabOptions}
        value={activeTab}
        onValueChange={setActiveTab}
        size="sm"
        variant="pills"
        className="!w-fit"
      />
      {activeTab === "tracking-stocks" && (
        <Button onClick={openAddDialog} size="sm" variant="ghost" className="h-8 w-8 p-0">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      )}
      {activeTab === "trending" && (
        <SearchInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search stocks..."
          containerClassName="w-24 sm:w-36 md:w-48 lg:w-64"
        />
      )}
    </div>
  );

  return (
    <DashboardLayout title="Stocks" showHeader={true} headerActions={headerActions}>
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <StockHeroSection className="hidden lg:block" />
        {/* Content */}
        <div className="w-full relative p-4 min-w-0">
          <div className="flex-1 overflow-hidden">
            {activeTab === "trending" ? (
              <TrendingStocksTable searchQuery={searchQuery} />
            ) : (
              <TrackingStocksTable />
            )}
          </div>
        </div>
      </div>
      {/* Stock Search Dialog */}
      <StockSearchDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSelect={handleStockSelect}
      />
    </DashboardLayout>
  );
}
