"use client";

import { useState } from "react";
import Image from "next/image";
import { useBreakpoints } from "@/hooks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchInput } from "@/components/ui/search-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  KOL,
  Platform,
  platformConfig,
  formatFollowers,
  CreateKOLInput,
} from "@/lib/kolApi";
import { trackKOL, untrackKOL } from "@/lib/trackedKolApi";
import type { Platform as DBPlatform } from "@/lib/supabase/database.types";
import { Trash2, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { CardSkeleton } from "./LoadingSkeleton";

interface KOLTrackerTableProps {
  kols: KOL[];
  onUpdate: () => void;
  loading?: boolean;
}

export default function KOLTrackerTable({
  kols,
  onUpdate,
  loading = false,
}: KOLTrackerTableProps) {
  const { isMobile } = useBreakpoints();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingKOLId, setDeletingKOLId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlatform, setFilterPlatform] = useState<Platform | "all">("all");

  // Form state for add/edit
  const [formData, setFormData] = useState<CreateKOLInput>({
    name: "",
    username: "",
    platform: "twitter",
    followers: 0,
    description: "",
    avatarUrl: "",
    isTracking: false,
  });

  // Filter KOLs (only tracked KOLs are shown in this component)
  const filteredKOLs = kols.filter((kol) => {
    // Search filter
    const matchesSearch =
      kol.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kol.username.toLowerCase().includes(searchTerm.toLowerCase());

    // Platform filter
    const matchesPlatform =
      filterPlatform === "all" || kol.platform === filterPlatform;

    return matchesSearch && matchesPlatform;
  });

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      username: "",
      platform: "twitter",
      followers: 0,
      description: "",
      avatarUrl: "",
      isTracking: false,
    });
  };

  // Handle add KOL - now uses real tracking API
  const handleAdd = async () => {
    try {
      // Map platform types for the tracking API
      const platformMap: { [key: string]: DBPlatform } = {
        twitter: "TWITTER",
        reddit: "REDDIT",
        youtube: "YOUTUBE",
        rednote: "REDNOTE",
      };

      await trackKOL({
        kol_id: formData.username,
        platform: platformMap[formData.platform],
        notify: true,
      });
      toast.success("KOL added to tracking list successfully");
      setIsAddDialogOpen(false);
      resetForm();
      onUpdate();
    } catch (error) {
      toast.error("Failed to add KOL");
      console.error(error);
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (id: string) => {
    setDeletingKOLId(id);
    setIsDeleteDialogOpen(true);
  };

  // Handle delete KOL - now uses real tracking API
  const handleDelete = async () => {
    if (!deletingKOLId) return;

    try {
      // Find the KOL to get its platform
      const kol = kols.find((k) => k.id === deletingKOLId);
      if (!kol) {
        throw new Error("KOL not found");
      }

      // Map platform type to database format
      const platformMap: { [key: string]: DBPlatform } = {
        twitter: "TWITTER",
        reddit: "REDDIT",
        youtube: "YOUTUBE",
        rednote: "REDNOTE",
      };

      await untrackKOL(deletingKOLId, platformMap[kol.platform]);
      toast.success("KOL removed from tracking list successfully");
      setIsDeleteDialogOpen(false);
      setDeletingKOLId(null);
      onUpdate();
    } catch (error) {
      toast.error("Failed to remove KOL");
      console.error(error);
    }
  };

  // Handle toggle tracking - now uses real tracking API
  const handleToggleTracking = async (kol: KOL) => {
    try {
      // Map platform type to database format
      const platformMap: { [key: string]: DBPlatform } = {
        twitter: "TWITTER",
        reddit: "REDDIT",
        youtube: "YOUTUBE",
        rednote: "REDNOTE",
      };

      // In the tracked tab, toggle means untrack
      await untrackKOL(kol.id, platformMap[kol.platform]);
      toast.success("Stopped tracking KOL");
      onUpdate();
    } catch (error) {
      toast.error("Failed to update tracking status");
      console.error(error);
    }
  };

  // Open add dialog
  const openAddDialog = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  // Loading state - KOL Table Skeleton
  const KOLTableRowSkeleton = () => (
    <TableRow>
      <TableCell className="py-3">
        <div className="flex items-center gap-2.5 animate-pulse">
          <div className="w-9 h-9 rounded-full bg-gray-300 dark:bg-white/10 flex-shrink-0"></div>
          <div className="flex-1 min-w-0">
            <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-24 mb-1.5"></div>
            <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-20"></div>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <div className="flex items-center gap-1.5 animate-pulse">
          <div className="w-4 h-4 bg-gray-300 dark:bg-white/10 rounded"></div>
          <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-16"></div>
        </div>
      </TableCell>
      <TableCell className="text-center py-3">
        <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-16 mx-auto animate-pulse"></div>
      </TableCell>
      <TableCell className="hidden lg:table-cell py-3">
        <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-40 animate-pulse"></div>
      </TableCell>
      <TableCell className="text-right py-3">
        <div className="flex justify-end gap-1">
          <div className="w-8 h-8 bg-gray-300 dark:bg-white/10 rounded animate-pulse"></div>
        </div>
      </TableCell>
    </TableRow>
  );

  const KOLCardSkeleton = () => (
    <div className="border border-border-light dark:border-border-dark rounded-lg p-3 bg-card-light dark:bg-card-dark animate-pulse">
      <div className="flex items-start gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-white/10 flex-shrink-0"></div>
        <div className="flex-1 min-w-0">
          <div className="h-4 bg-gray-300 dark:bg-white/10 rounded w-24 mb-1.5"></div>
          <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-20"></div>
        </div>
        <div className="flex gap-1">
          <div className="w-7 h-7 bg-gray-300 dark:bg-white/10 rounded"></div>
          <div className="w-7 h-7 bg-gray-300 dark:bg-white/10 rounded"></div>
        </div>
      </div>
      <div className="flex items-center justify-between mb-2">
        <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-20"></div>
        <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-24"></div>
      </div>
      <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-full mb-1"></div>
      <div className="h-3 bg-gray-300 dark:bg-white/10 rounded w-3/4"></div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {/* Filters Skeleton */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between animate-pulse">
          <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full">
            <div className="h-10 bg-gray-200 dark:bg-white/5 rounded-lg border border-border-light dark:border-border-dark flex-1"></div>
            <div className="h-10 bg-gray-200 dark:bg-white/5 rounded-lg border border-border-light dark:border-border-dark w-full sm:w-[200px]"></div>
          </div>
          <div className="h-10 bg-gray-200 dark:bg-white/5 rounded-lg w-full sm:w-auto sm:min-w-[140px]"></div>
        </div>

        {/* Table/Cards Skeleton */}
        {isMobile ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <KOLCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="border border-border-light dark:border-border-dark rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Creator</TableHead>
                  <TableHead className="text-xs">Platform</TableHead>
                  <TableHead className="text-xs text-center">
                    Followers
                  </TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">
                    Description
                  </TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <KOLTableRowSkeleton key={i} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full">
          <SearchInput
            placeholder="Search tracked KOLs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select
            value={filterPlatform}
            onValueChange={(value) =>
              setFilterPlatform(value as Platform | "all")
            }
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue>
                <span className="text-xs">All Platforms</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="text-xs">All Platforms</span>
              </SelectItem>
              <SelectItem value="twitter">
                <span className="text-xs">X (Twitter)</span>
              </SelectItem>
              <SelectItem value="reddit">
                <span className="text-xs">Reddit</span>
              </SelectItem>
              <SelectItem value="rednote">
                <span className="text-xs">Rednote</span>
              </SelectItem>
              <SelectItem value="youtube">
                <span className="text-xs">YouTube</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={openAddDialog}
          size="lg"
          className="flex items-center gap-1.5 h-[40px] w-full sm:w-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Track New KOL
        </Button>
      </div>

      {/* Mobile Card View */}
      {isMobile ? (
        <div className="space-y-2">
          {filteredKOLs.length === 0 ? (
            <div className="text-center py-8 border border-border-light dark:border-border-dark rounded-lg">
              <p className="text-xs text-gray-500 dark:text-white/50">
                {kols.length === 0
                  ? "No tracked KOLs yet. Click 'Track New KOL' button to start tracking."
                  : "No KOLs match your search criteria."}
              </p>
            </div>
          ) : (
            filteredKOLs.map((kol) => (
              <div
                key={kol.id}
                className="border border-border-light dark:border-border-dark rounded-lg p-3 bg-card-light dark:bg-card-dark"
              >
                {/* Header with Avatar, Name and Actions */}
                <div className="flex items-start gap-3 mb-2">
                  {/* Avatar */}
                  {kol.avatarUrl ? (
                    <Image
                      src={kol.avatarUrl}
                      alt={kol.name}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full flex-shrink-0 ring-2 ring-gray-200 dark:ring-white/10"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center flex-shrink-0 ring-2 ring-gray-200 dark:ring-white/10">
                      <span className="text-xs font-bold text-gray-600 dark:text-white/60">
                        {kol.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {kol.name}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-white/60 truncate">
                      {kol.username}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleToggleTracking(kol)}
                      className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950/20 h-7 w-7 p-0"
                      title="Stop tracking"
                    >
                      <Star className="w-3.5 h-3.5 fill-yellow-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => openDeleteDialog(kol.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 h-7 w-7 p-0"
                      title="Remove from tracking"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
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
                  <span className="text-xs font-medium text-gray-900 dark:text-white">
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
        <div className="border border-border-light dark:border-border-dark rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Creator</TableHead>
                <TableHead className="text-xs">Platform</TableHead>
                <TableHead className="text-xs text-center">Followers</TableHead>
                <TableHead className="text-xs hidden lg:table-cell">
                  Description
                </TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredKOLs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <p className="text-xs text-gray-500 dark:text-white/50">
                      {kols.length === 0
                        ? "No tracked KOLs yet. Click 'Track New KOL' button to start tracking."
                        : "No KOLs match your search criteria."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredKOLs.map((kol) => (
                  <TableRow key={kol.id}>
                    {/* Creator with Avatar */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2.5">
                        {kol.avatarUrl ? (
                          <Image
                            src={kol.avatarUrl}
                            alt={kol.name}
                            width={36}
                            height={36}
                            className="w-9 h-9 rounded-full ring-2 ring-gray-100 dark:ring-white/10 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center ring-2 ring-gray-100 dark:ring-white/10 flex-shrink-0">
                            <span className="text-xs font-bold text-gray-600 dark:text-white/60">
                              {kol.name.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {kol.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-white/50 truncate">
                            {kol.username}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    {/* Platform */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1.5">
                        <Image
                          src={platformConfig[kol.platform].icon}
                          alt={platformConfig[kol.platform].name}
                          width={16}
                          height={16}
                          className="opacity-80"
                        />
                        <span className="text-xs">
                          {platformConfig[kol.platform].name}
                        </span>
                      </div>
                    </TableCell>
                    {/* Followers */}
                    <TableCell className="text-xs text-center font-semibold py-3">
                      {formatFollowers(kol.followers)}
                    </TableCell>
                    {/* Description */}
                    <TableCell className="text-xs max-w-[250px] truncate hidden lg:table-cell py-3">
                      {kol.description}
                    </TableCell>
                    {/* Actions */}
                    <TableCell className="text-right py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => openDeleteDialog(kol.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                          title="Remove from tracking"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Track New KOL</DialogTitle>
            <DialogDescription>
              Add a creator from our database to your tracking list. You can
              find creator IDs from the Top Ranking tab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs">
                Creator ID *
              </Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                placeholder="Enter creator ID from database"
                className="h-8 text-xs"
              />
              <p className="text-xs text-gray-500 dark:text-white/50">
                Find creators in the Top Ranking tab and use their ID
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="platform" className="text-xs">
                Platform *
              </Label>
              <Select
                value={formData.platform}
                onValueChange={(value: Platform) =>
                  setFormData({ ...formData, platform: value })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="twitter">X (Twitter)</SelectItem>
                  <SelectItem value="reddit">Reddit</SelectItem>
                  <SelectItem value="rednote">Rednote</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddDialogOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              size="sm"
              className="h-8 text-xs"
              disabled={!formData.username.trim()}
            >
              Track
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove KOL from Tracking</DialogTitle>
            <DialogDescription>
              Are you sure you want to stop tracking this KOL? You can add them
              back to your tracking list later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              size="sm"
              className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
