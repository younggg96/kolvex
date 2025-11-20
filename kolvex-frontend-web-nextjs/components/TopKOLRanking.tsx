"use client";

import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SwitchTab } from "@/components/ui/switch-tab";
import {
  KOL,
  Platform,
  platformConfig,
  formatFollowers,
  updateKOL,
} from "@/lib/kolApi";
import { Star, StarOff, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useBreakpoints } from "@/hooks";

interface TopKOLRankingProps {
  kols: KOL[];
  onUpdate: () => void;
}

export default function TopKOLRanking({ kols, onUpdate }: TopKOLRankingProps) {
  const { isMobile } = useBreakpoints();
  const [filterPlatform, setFilterPlatform] = useState<Platform | "all">("all");

  // Filter and sort KOLs by followers
  const rankedKOLs = kols
    .filter(
      (kol) => filterPlatform === "all" || kol.platform === filterPlatform
    )
    .sort((a, b) => b.followers - a.followers)
    .slice(0, 20); // Top 20

  // Handle toggle tracking
  const handleToggleTracking = async (kol: KOL) => {
    try {
      await updateKOL(kol.id, { isTracking: !kol.isTracking });
      toast.success(
        kol.isTracking ? "Stopped tracking KOL" : "Started tracking KOL"
      );
      onUpdate();
    } catch (error) {
      toast.error("Failed to update tracking status");
      console.error(error);
    }
  };

  return (
    <div className="space-y-3">
      {/* Platform Filter */}
      <div className="mb-3">
        <SwitchTab
          options={[
            { value: "all", label: "All" },
            { value: "twitter", label: "X" },
            { value: "reddit", label: "Reddit" },
            { value: "rednote", label: "Rednote" },
            { value: "youtube", label: "YouTube" },
          ]}
          value={filterPlatform}
          onValueChange={(value) =>
            setFilterPlatform(value as Platform | "all")
          }
          size="md"
          variant="underline"
        />
      </div>

      {/* Mobile Card View */}
      {isMobile ? (
        <div className="space-y-2">
          {rankedKOLs.length === 0 ? (
            <div className="text-center py-8 border border-border-light dark:border-border-dark rounded-lg">
              <p className="text-xs text-gray-500 dark:text-white/50">
                No KOLs found
              </p>
            </div>
          ) : (
            rankedKOLs.map((kol, index) => (
              <div
                key={kol.id}
                className="border border-border-light dark:border-border-dark rounded-lg p-3 bg-card-light dark:bg-card-dark"
              >
                {/* Rank Badge and Track Button */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                        index === 0
                          ? "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-500"
                          : index === 1
                          ? "bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400"
                          : index === 2
                          ? "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-500"
                          : "bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-white/50"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {kol.name}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-white/60 truncate">
                        {kol.username}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleToggleTracking(kol)}
                    title={kol.isTracking ? "Stop tracking" : "Start tracking"}
                    className="h-7 w-7 p-0 ml-2"
                  >
                    {kol.isTracking ? (
                      <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                    ) : (
                      <StarOff className="w-4 h-4 text-gray-400" />
                    )}
                  </Button>
                </div>

                {/* Platform and Followers */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Image
                      src={platformConfig[kol.platform].icon}
                      alt={platformConfig[kol.platform].name}
                      width={14}
                      height={14}
                      className="opacity-70"
                    />
                    <span className="text-xs text-gray-700 dark:text-white/70">
                      {platformConfig[kol.platform].name}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">
                    {formatFollowers(kol.followers)} followers
                  </span>
                </div>

                {/* Description */}
                {kol.description && (
                  <p className="text-xs text-gray-600 dark:text-white/60 line-clamp-2">
                    {kol.description}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* Desktop Table View */
        <div className="border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-12">Rank</TableHead>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Platform</TableHead>
                <TableHead className="text-xs">Followers</TableHead>
                <TableHead className="text-xs hidden md:table-cell">
                  Description
                </TableHead>
                <TableHead className="text-xs text-center">Track</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedKOLs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <p className="text-xs text-gray-500 dark:text-white/50">
                      No KOLs found
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                rankedKOLs.map((kol, index) => (
                  <TableRow key={kol.id}>
                    <TableCell className="text-xs font-bold text-center">
                      <div
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                          index === 0
                            ? "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-500"
                            : index === 1
                            ? "bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400"
                            : index === 2
                            ? "bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-500"
                            : "text-gray-500 dark:text-white/50"
                        }`}
                      >
                        {index + 1}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      <div>
                        <div>{kol.name}</div>
                        <div className="text-[10px] text-gray-500 dark:text-white/40">
                          {kol.username}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Image
                          src={platformConfig[kol.platform].icon}
                          alt={platformConfig[kol.platform].name}
                          width={16}
                          height={16}
                          className="opacity-70"
                        />
                        <span className="text-xs">
                          {platformConfig[kol.platform].name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold">
                      {formatFollowers(kol.followers)}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate hidden md:table-cell">
                      {kol.description || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleToggleTracking(kol)}
                        title={
                          kol.isTracking ? "Stop tracking" : "Start tracking"
                        }
                        className="mx-auto"
                      >
                        {kol.isTracking ? (
                          <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
                        ) : (
                          <StarOff className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
