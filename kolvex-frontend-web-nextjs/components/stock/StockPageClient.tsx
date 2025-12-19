"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TrendingStocksTable from "@/components/trending-stocks";
import TrackedStocksTable from "@/components/tracking-stocks/TrackingStocksTable";
import StockSearchDialog from "@/components/stock/StockSearchDialog";
import { SwitchTab } from "@/components/ui/switch-tab";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, Star } from "lucide-react";
import { createTrackedStock } from "@/lib/trackedStockApi";
import { toast } from "sonner";
import { SearchInput } from "../ui/search-input";
import { StockHeroSection } from "./StockHeroSection";
import { useBreakpoints } from "@/hooks/useBreakpoints";

export default function StockPageClient() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("trending");
  const [searchQuery, setSearchQuery] = useState("");
  const { isMobile, isTablet, isLaptop, isDesktop, isWide } = useBreakpoints();

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
      value: "tracked-stocks",
      label: "Tracking Stocks",
      icon: <Star className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <DashboardLayout
      title="Stocks"
      showHeader={isMobile || isTablet || isLaptop}
    >
      <div className="relative flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        {(isDesktop || isWide) && <StockHeroSection />}
        {/* Header with Tabs and Add Button */}
        <div className="space-y-3 w-full relative p-4 min-w-0">
          <div className="flex items-center justify-between gap-4 w-full">
            <SwitchTab
              options={tabOptions}
              value={activeTab}
              onValueChange={setActiveTab}
              size="md"
              variant="pills"
              className="!w-fit"
            />
            {activeTab === "tracked-stocks" && (
              <Button onClick={openAddDialog} size="sm" variant="ghost">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            )}
            {activeTab === "trending" && (
              <SearchInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stocks..."
                containerClassName="w-full max-w-[300px]"
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "trending" ? (
              <TrendingStocksTable searchQuery={searchQuery} />
            ) : (
              <TrackedStocksTable />
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
