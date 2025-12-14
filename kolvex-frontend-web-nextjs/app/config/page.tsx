"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks";
import {
  updateUserProfile,
  updateNotificationSettings,
  addKOL,
} from "@/lib/supabase/api";
import { updateStockTracking } from "@/lib/supabase/api/users";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  ArrowRight,
  Check,
  Sparkles,
  Users,
  TrendingUp,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import sp500Data from "@/data/sp500.constituents.wikilogo.json";
import SectionCard from "@/components/layout/SectionCard";
import CompanyLogo from "@/components/ui/company-logo";
import ThemeToggle from "@/components/theme/ThemeToggle";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import type {
  NotificationMethod,
  Platform,
} from "@/lib/supabase/database.types";

// 推荐博主列表（使用 mock 头像）
const RECOMMENDED_KOLS = [
  {
    id: "elonmusk",
    name: "Elon Musk",
    platform: "TWITTER" as Platform,
    avatarUrl:
      "https://pbs.twimg.com/profile_images/1815749056821346304/jS8I28PL_400x400.jpg",
  },
  {
    id: "chamath",
    name: "Chamath Palihapitiya",
    platform: "TWITTER" as Platform,
    avatarUrl:
      "https://pbs.twimg.com/profile_images/1321163587679784960/0ZxKlEKB_400x400.jpg",
  },
  {
    id: "cathiewood",
    name: "Cathie Wood",
    platform: "TWITTER" as Platform,
    avatarUrl:
      "https://pbs.twimg.com/profile_images/1441868928388685825/H0648g7Y_400x400.jpg",
  },
  {
    id: "naval",
    name: "Naval Ravikant",
    platform: "TWITTER" as Platform,
    avatarUrl:
      "https://pbs.twimg.com/profile_images/1417848948168839170/xP5RuZjw_400x400.jpg",
  },
  {
    id: "balajis",
    name: "Balaji Srinivasan",
    platform: "TWITTER" as Platform,
    avatarUrl:
      "https://pbs.twimg.com/profile_images/1589981011931873280/xmTPr3M2_400x400.jpg",
  },
  {
    id: "jimcramer",
    name: "Jim Cramer",
    platform: "TWITTER" as Platform,
    avatarUrl:
      "https://pbs.twimg.com/profile_images/1488927851287318530/bGVcnK0c_400x400.jpg",
  },
];

// 从 SP500 数据中获取推荐股票
const getRecommendedStocks = () => {
  const symbols = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "TSLA",
    "NVDA",
    "META",
    "NFLX",
    "JPM",
    "V",
    "DIS",
    "WMT",
  ];
  return symbols
    .map((symbol) => {
      const stockData = sp500Data.find((s: any) => s.symbol === symbol);
      return {
        symbol,
        name: stockData?.name || symbol,
        logoUrl: stockData?.logoUrl || "",
      };
    })
    .filter((stock) => stock.logoUrl); // 只保留有 logo 的股票
};

const RECOMMENDED_STOCKS = getRecommendedStocks();

export default function ConfigPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [notificationMethod, setNotificationMethod] =
    useState<NotificationMethod>("EMAIL");
  const [isSubscribeNewsletter, setIsSubscribeNewsletter] = useState(false);
  const [selectedKOLs, setSelectedKOLs] = useState<string[]>([]);
  const [selectedStocks, setSelectedStocks] = useState<string[]>([]);

  useEffect(() => {
    // Wait for auth to finish loading before redirecting
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  const totalSteps = 3;

  const handleNext = () => {
    if (currentStep === 1 && !notificationMethod) {
      toast.error("Please select a notification method");
      return;
    }
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleKOL = (kolId: string) => {
    setSelectedKOLs((prev) =>
      prev.includes(kolId)
        ? prev.filter((id) => id !== kolId)
        : [...prev, kolId]
    );
  };

  const toggleStock = (symbol: string) => {
    setSelectedStocks((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol]
    );
  };

  const handleFinish = async () => {
    if (!user?.id) return;

    setIsLoading(true);

    try {
      // 1. Update notification settings
      const notificationResult = await updateNotificationSettings(user.id, {
        notification_method: notificationMethod,
      });

      if (!notificationResult.success) {
        throw new Error(
          notificationResult.error || "Failed to update notifications"
        );
      }

      // 2. Update newsletter subscription
      const profileResult = await updateUserProfile(user.id, {
        is_subscribe_newsletter: isSubscribeNewsletter,
      });

      if (!profileResult.success) {
        throw new Error(profileResult.error || "Failed to update profile");
      }

      // 3. Add selected KOLs
      if (selectedKOLs.length > 0) {
        const kolPromises = selectedKOLs.map((kolId) => {
          const kol = RECOMMENDED_KOLS.find((k) => k.id === kolId);
          if (!kol) return Promise.resolve({ success: true });

          return addKOL({
            user_id: user.id,
            platform: kol.platform,
            kol_id: kolId,
            notify: true,
          });
        });

        await Promise.all(kolPromises);
      }

      // 4. Update stock tracking
      if (selectedStocks.length > 0) {
        const stockResult = await updateStockTracking(user.id, selectedStocks);
        if (!stockResult.success) {
          console.warn("Stock tracking update warning:", stockResult.error);
        }
      }

      toast.success("Welcome! Your preferences have been saved.");

      // Redirect to dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (error: any) {
      console.error("Setup error:", error);
      toast.error(error.message || "Failed to save preferences");
      setIsLoading(false);
    }
  };

  // Show loading state while auth is loading
  if (authLoading) {
    return <LoadingSpinner fullScreen showCard />;
  }

  // Redirect to auth if not authenticated (after loading is complete)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-primary/10 dark:from-background-dark dark:via-background-dark dark:to-primary/5 flex items-center justify-center p-4">
      {/* Animated Grid Background */}
      <div className="absolute inset-0 bg-grid z-0"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background-light/90 dark:via-background-dark/90 to-background-light dark:to-background-dark z-0"></div>

      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-5">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            Setup Your Preferences
          </h1>
          <p className="text-xs text-gray-600 dark:text-white/60">
            Step {currentStep} of {totalSteps}
          </p>
        </div>

        {/* Card */}
        {currentStep === 1 && (
          <SectionCard
            icon={<Bell className="w-5 h-5 text-primary" />}
            title="Notifications"
            titleSize="sm"
            padding="md"
            className="shadow-md"
          >
            <div className="px-4 pb-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Method</Label>
                  <Select
                    value={notificationMethod}
                    onValueChange={(value) =>
                      setNotificationMethod(value as NotificationMethod)
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMAIL">Email</SelectItem>
                      <SelectItem value="MESSAGE">Message</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-md border border-gray-200 dark:border-white/10">
                  <Label
                    htmlFor="newsletter"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Newsletter
                  </Label>
                  <Switch
                    id="newsletter"
                    checked={isSubscribeNewsletter}
                    onCheckedChange={setIsSubscribeNewsletter}
                  />
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2 px-4 pb-4 pt-2 border-t border-gray-200 dark:border-white/10">
              <div className="flex-1"></div>

              <button
                onClick={() => router.push("/dashboard")}
                className="text-xs text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors px-2"
                disabled={isLoading}
              >
                Skip
              </button>

              <Button onClick={handleNext} size="sm" className="gap-1">
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </SectionCard>
        )}

        {currentStep === 2 && (
          <SectionCard
            icon={<Users className="w-5 h-5 text-primary" />}
            title="Follow KOLs"
            titleSize="sm"
            padding="md"
            className="shadow-md"
          >
            <div className="px-4 pb-4">
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {RECOMMENDED_KOLS.map((kol) => (
                  <div
                    key={kol.id}
                    onClick={() => toggleKOL(kol.id)}
                    className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-all ${
                      selectedKOLs.includes(kol.id)
                        ? "border-primary bg-primary/5 dark:bg-primary/10"
                        : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                    }`}
                  >
                    <Checkbox
                      checked={selectedKOLs.includes(kol.id)}
                      onCheckedChange={() => toggleKOL(kol.id)}
                      className="pointer-events-none"
                    />
                    <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                      <Image
                        src={kol.avatarUrl}
                        alt={kol.name}
                        fill
                        className="object-cover"
                        sizes="32px"
                      />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white flex-1 truncate">
                      {kol.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2 px-4 pb-4 pt-2 border-t border-gray-200 dark:border-white/10">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={isLoading}
                size="sm"
                className="gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </Button>

              <div className="flex-1"></div>

              <button
                onClick={() => router.push("/dashboard")}
                className="text-xs text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors px-2"
                disabled={isLoading}
              >
                Skip
              </button>

              <Button onClick={handleNext} size="sm" className="gap-1">
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </SectionCard>
        )}

        {currentStep === 3 && (
          <SectionCard
            icon={<TrendingUp className="w-5 h-5 text-primary" />}
            title="Track Stocks"
            titleSize="sm"
            padding="md"
            className="shadow-md"
          >
            <div className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
                {RECOMMENDED_STOCKS.map((stock) => (
                  <div
                    key={stock.symbol}
                    onClick={() => toggleStock(stock.symbol)}
                    className={`flex items-center gap-1.5 p-2 rounded-md border cursor-pointer transition-all ${
                      selectedStocks.includes(stock.symbol)
                        ? "border-primary bg-primary/5 dark:bg-primary/10"
                        : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                    }`}
                  >
                    <Checkbox
                      checked={selectedStocks.includes(stock.symbol)}
                      onCheckedChange={() => toggleStock(stock.symbol)}
                      className="pointer-events-none"
                    />
                    <CompanyLogo
                      symbol={stock.symbol}
                      name={stock.name}
                      size="sm"
                      shape="rounded"
                      border="light"
                      unoptimized
                    />
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {stock.symbol}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2 px-4 pb-4 pt-2 border-t border-gray-200 dark:border-white/10">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={isLoading}
                size="sm"
                className="gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </Button>

              <div className="flex-1"></div>

              <button
                onClick={() => router.push("/dashboard")}
                className="text-xs text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors px-2"
                disabled={isLoading}
              >
                Skip
              </button>

              <Button
                onClick={handleFinish}
                disabled={isLoading}
                size="sm"
                className="gap-1"
              >
                {isLoading ? "Saving..." : "Finish"}
                {!isLoading && <Check className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
