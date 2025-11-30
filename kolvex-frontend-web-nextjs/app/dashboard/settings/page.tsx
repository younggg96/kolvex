"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import Image from "next/image";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import {
  CreditCard,
  Bell,
  Settings,
  Sparkles,
  Globe,
  Sun,
  Moon,
  Monitor,
  SunMoon,
  User,
  Mail,
  Phone,
  Edit,
  Check,
  Camera,
  Upload,
  Image as ImageIcon,
  UserCircle,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import SectionCard from "@/components/SectionCard";
import PricingCard from "@/components/PricingCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwitchTab } from "@/components/ui/switch-tab";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { ProfileInfoSkeleton } from "@/components/LoadingSkeleton";
import {
  useCurrentUserProfile,
  updateUserTheme,
  updateUserNotifications,
  type UserProfileUpdate,
} from "@/lib/api/userApi";

const settingsTabs = [
  { value: "account", icon: User, label: "Account" },
  { value: "billing", icon: CreditCard, label: "Billing" },
  { value: "notifications", icon: Bell, label: "Notifications" },
  { value: "preferences", icon: Settings, label: "Preferences" },
];

const getPricingPlans = (currentMembership: string) => [
  {
    name: "Free",
    price: 0,
    features: [
      { text: "Basic market data", included: true },
      { text: "5 watchlist stocks", included: true },
      { text: "Daily market news", included: true },
      { text: "Real-time data", included: false },
      { text: "AI analysis", included: false },
    ],
    buttonText: currentMembership === "FREE" ? "Current Plan" : "Downgrade",
    buttonVariant: "outline" as const,
    buttonDisabled: currentMembership === "FREE",
    badge:
      currentMembership === "FREE"
        ? { icon: Sparkles, text: "Current Plan" }
        : undefined,
    highlight: currentMembership === "FREE",
  },
  {
    name: "Pro",
    price: 29,
    features: [
      { text: "Real-time market data", included: true, highlighted: true },
      { text: "Unlimited watchlist", included: true, highlighted: true },
      { text: "AI-powered analysis", included: true, highlighted: true },
      { text: "Advanced charts", included: true, highlighted: true },
      { text: "Priority support", included: true, highlighted: true },
    ],
    buttonText: currentMembership === "PRO" ? "Current Plan" : "Upgrade",
    buttonVariant: "default" as const,
    buttonDisabled: currentMembership === "PRO",
    badge:
      currentMembership === "PRO"
        ? { icon: Sparkles, text: "Current Plan" }
        : undefined,
    highlight: currentMembership === "PRO",
    popularLabel: "POPULAR",
  },
  {
    name: "Enterprise",
    price: 99,
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Custom AI models", included: true },
      { text: "API access", included: true },
      { text: "Team collaboration", included: true },
      { text: "24/7 dedicated support", included: true },
    ],
    buttonText: currentMembership === "ENTERPRISE" ? "Current Plan" : "Upgrade",
    buttonVariant: "default" as const,
    buttonDisabled: currentMembership === "ENTERPRISE",
    badge:
      currentMembership === "ENTERPRISE"
        ? { icon: Sparkles, text: "Current Plan" }
        : undefined,
    highlight: currentMembership === "ENTERPRISE",
  },
];

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const { user, isLoading: authLoading } = useAuth();
  const {
    profile,
    loading: profileLoading,
    updateProfile,
    updateTheme: updateProfileTheme,
    updateNotifications,
    refetch: refreshProfile,
  } = useCurrentUserProfile();

  const [activeTab, setActiveTab] = useState("account");
  const [mounted, setMounted] = useState(false);

  // Profile editing state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Cropper state
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    username: "",
    full_name: "",
    email: "",
    phone: "",
  });

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState({
    is_subscribe_newsletter: false,
    notification_method: "EMAIL" as "EMAIL" | "MESSAGE",
  });

  // Load profile data into form
  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || "",
        full_name: profile.full_name || "",
        email: profile.email || "",
        phone: profile.phone_e164 || "",
      });
      setNotificationSettings({
        is_subscribe_newsletter: profile.is_subscribe_newsletter || false,
        notification_method: profile.notification_method || "EMAIL",
      });
    }
  }, [profile]);

  useEffect(() => {
    setMounted(true);

    // Get tab from URL
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/dashboard/settings?tab=${value}`, { scroll: false });
  };

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme);

    if (profile) {
      // Update theme in database via API
      const themeValue = newTheme.toUpperCase() as "LIGHT" | "DARK" | "SYSTEM";
      const result = await updateProfileTheme(themeValue);

      if (!result.success) {
        toast.error("Failed to update theme");
      }
    }
  };

  const processFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
      // Reset cropper state
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const onCropComplete = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const createCroppedImage = async (
    imageSrc: string,
    pixelCrop: Area
  ): Promise<Blob | null> => {
    const image = document.createElement("img");
    image.src = imageSrc;

    return new Promise((resolve) => {
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(null);
          return;
        }

        // Set canvas size to desired output size (square)
        const size = Math.min(pixelCrop.width, pixelCrop.height);
        canvas.width = size;
        canvas.height = size;

        // Draw the cropped image
        ctx.drawImage(
          image,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          size,
          size
        );

        canvas.toBlob(
          (blob) => {
            resolve(blob);
          },
          "image/jpeg",
          0.95
        );
      };
    });
  };

  const clearAvatarState = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setUploadProgress(0);
  };

  const handleAvatarDialogClose = (open: boolean) => {
    if (!open) {
      clearAvatarState();
    }
    setAvatarDialogOpen(open);
  };

  const handleUploadAvatar = async () => {
    if (!previewUrl || !user || !croppedAreaPixels) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress for cropping
      setUploadProgress(10);

      // Create cropped image
      const croppedBlob = await createCroppedImage(
        previewUrl,
        croppedAreaPixels
      );
      if (!croppedBlob) {
        throw new Error("Failed to crop image");
      }

      setUploadProgress(30);

      const supabase = createClient();
      const fileName = `${user.id}-${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 80) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const { error: uploadError } = await supabase.storage
        .from("user-uploads")
        .upload(filePath, croppedBlob, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg",
        });

      clearInterval(progressInterval);
      setUploadProgress(90);

      if (uploadError) {
        // Provide more helpful error messages
        if (uploadError.message?.includes("Bucket not found")) {
          throw new Error(
            "Storage not configured. Please contact administrator to set up the 'user-uploads' bucket in Supabase."
          );
        }
        if (uploadError.message?.includes("row-level security")) {
          throw new Error(
            "Permission denied. Please check Storage RLS policies."
          );
        }
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("user-uploads").getPublicUrl(filePath);

      // Update via backend API
      const result = await updateProfile({
        avatar_url: publicUrl,
      });

      setUploadProgress(100);

      if (result.success) {
        toast.success("Avatar updated successfully");
        handleAvatarDialogClose(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload avatar");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSaveChanges = async () => {
    if (!user) return;

    if (formData.phone && formData.phone.trim() !== "") {
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(formData.phone)) {
        toast.error(
          "Invalid phone format. Use E.164 format: +[country code][number] (e.g., +14155552671)"
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      const updates: UserProfileUpdate = {
        username: formData.username || undefined,
        full_name: formData.full_name || undefined,
        phone_e164:
          formData.phone && formData.phone.trim() !== ""
            ? formData.phone
            : undefined,
      };

      const result = await updateProfile(updates);

      if (result.success) {
        toast.success("Profile updated successfully");
        setIsEditing(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error("Save error:", error);
      if (error.message?.includes("chk_phone_format")) {
        toast.error(
          "Invalid phone format. Use E.164 format: +[country code][number]"
        );
      } else {
        toast.error(error.message || "Failed to update profile");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (profile) {
      setFormData({
        username: profile.username || "",
        full_name: profile.full_name || "",
        email: profile.email || "",
        phone: profile.phone_e164 || "",
      });
    }
    setIsEditing(false);
  };

  const handleNotificationChange = async (
    key: keyof typeof notificationSettings,
    value: boolean | "EMAIL" | "MESSAGE"
  ) => {
    const newSettings = { ...notificationSettings, [key]: value };
    setNotificationSettings(newSettings as typeof notificationSettings);

    // Update via backend API
    try {
      const result = await updateNotifications(newSettings);

      if (result.success) {
        toast.success("Notification settings updated");
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error("Notification update error:", error);
      toast.error(error.message || "Failed to update notification settings");
      // Revert on error
      setNotificationSettings(notificationSettings);
    }
  };

  const tabOptions = settingsTabs.map((tab) => ({
    value: tab.value,
    label: tab.label,
    icon: <tab.icon className="w-4 h-4" />,
  }));

  return (
    <DashboardLayout title="Settings">
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 min-w-0">
          {/* Settings Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <div className="flex flex-col gap-2">
              <SwitchTab
                value={activeTab}
                onValueChange={handleTabChange}
                options={tabOptions}
                size="md"
                variant="pills"
                className="!w-fit border border-gray-200 dark:border-white/10 rounded-lg"
              />

              {/* Tab Content Area */}
              <div className="flex-1 min-w-0">
                {/* Account Info Tab */}
                <TabsContent value="account" className="mt-0">
                  <SectionCard
                    title="Account Information"
                    useSectionHeader
                    sectionHeaderIcon={User}
                    sectionHeaderSubtitle={
                      isEditing
                        ? "Update your account details"
                        : "View your account details"
                    }
                    sectionHeaderAction={
                      !isEditing && !profileLoading ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditing(true)}
                          className="gap-1.5 h-8 text-xs"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </Button>
                      ) : undefined
                    }
                  >
                    {profileLoading ? (
                      <ProfileInfoSkeleton />
                    ) : (
                      <div className="space-y-4 px-4 pb-4">
                        {/* Avatar with fullscreen preview */}
                        <div className="flex items-center gap-3 sm:gap-4 p-2 sm:p-3">
                          <div className="relative">
                            {profile?.avatar_url ? (
                              <button
                                onClick={() => setAvatarPreviewOpen(true)}
                                className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shadow-lg cursor-pointer group"
                              >
                                <Image
                                  src={profile.avatar_url}
                                  alt="Profile"
                                  fill
                                  className="object-cover transition-transform duration-200 group-hover:scale-110"
                                  sizes="(max-width: 640px) 64px, 80px"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                                  <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                                </div>
                              </button>
                            ) : (
                              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-lg">
                                {profile?.username
                                  ? profile.username
                                      .substring(0, 2)
                                      .toUpperCase()
                                  : profile?.email
                                      ?.substring(0, 2)
                                      .toUpperCase() || "US"}
                              </div>
                            )}
                            <button
                              onClick={() => setAvatarDialogOpen(true)}
                              className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 bg-white dark:bg-card-dark rounded-full flex items-center justify-center shadow-md border-2 border-gray-200 dark:border-white/10 hover:scale-110 transition-all duration-200 cursor-pointer"
                            >
                              <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-600 dark:text-white/70" />
                            </button>
                          </div>
                        </div>

                        {/* Avatar fullscreen preview dialog */}
                        <Dialog
                          open={avatarPreviewOpen}
                          onOpenChange={setAvatarPreviewOpen}
                        >
                          <DialogContent className="w-[90vw] h-[90vh] max-w-[90vw] max-h-[90vh] !p-0 bg-black/95 border-none flex items-center justify-center">
                            {profile?.avatar_url && (
                              <div className="relative w-full h-full flex items-center justify-center">
                                <Image
                                  src={profile.avatar_url}
                                  alt="Profile"
                                  fill
                                  className="object-contain"
                                  sizes="90vw"
                                  priority
                                />
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>

                        {/* Avatar upload dialog with cropper */}
                        <Dialog
                          open={avatarDialogOpen}
                          onOpenChange={handleAvatarDialogClose}
                        >
                          <DialogContent className="w-[calc(100%-2rem)] max-w-lg mx-auto max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="text-base sm:text-lg">
                                Upload Avatar
                              </DialogTitle>
                              <DialogDescription className="text-xs sm:text-sm">
                                {previewUrl
                                  ? "Drag to reposition, scroll to zoom. Image will be cropped to a square."
                                  : "Choose an image file to upload as your profile picture."}
                              </DialogDescription>
                            </DialogHeader>
                            <div>
                              {/* Image cropper (shown when image is selected) */}
                              {previewUrl ? (
                                <div className="space-y-4 mb-4">
                                  {/* Cropper area */}
                                  <div className="relative w-full aspect-square bg-gray-900 rounded-xl overflow-hidden">
                                    <Cropper
                                      image={previewUrl}
                                      crop={crop}
                                      zoom={zoom}
                                      aspect={1}
                                      cropShape="round"
                                      showGrid={false}
                                      onCropChange={setCrop}
                                      onCropComplete={onCropComplete}
                                      onZoomChange={setZoom}
                                    />
                                  </div>

                                  {/* Zoom controls */}
                                  <div className="flex items-center gap-3 px-2">
                                    <ZoomOut className="w-4 h-4 text-gray-500 dark:text-white/50" />
                                    <input
                                      type="range"
                                      min={1}
                                      max={3}
                                      step={0.1}
                                      value={zoom}
                                      onChange={(e) =>
                                        setZoom(Number(e.target.value))
                                      }
                                      className="flex-1 h-2 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                    <ZoomIn className="w-4 h-4 text-gray-500 dark:text-white/50" />
                                  </div>

                                  {/* Action buttons for cropper */}
                                  <div className="flex items-center justify-between">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setCrop({ x: 0, y: 0 });
                                        setZoom(1);
                                      }}
                                      className="gap-1.5 h-8 text-xs"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      Reset
                                    </Button>
                                    <label
                                      htmlFor="avatar-upload-change"
                                      className="cursor-pointer"
                                    >
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5 h-8 text-xs pointer-events-none"
                                      >
                                        <ImageIcon className="w-3 h-3" />
                                        Change Image
                                      </Button>
                                      <input
                                        id="avatar-upload-change"
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                      />
                                    </label>
                                  </div>
                                </div>
                              ) : (
                                /* Upload area (shown when no image selected) */
                                <div className="flex items-center justify-center w-full">
                                  <label
                                    htmlFor="avatar-upload"
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={`flex flex-col items-center justify-center w-full h-48 sm:h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                                      isDragging
                                        ? "border-primary bg-primary/10 dark:bg-primary/20 scale-[1.02]"
                                        : "border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10"
                                    }`}
                                  >
                                    <div className="flex flex-col items-center justify-center pt-4 pb-5 sm:pt-5 sm:pb-6 px-4">
                                      <div
                                        className={`mb-3 sm:mb-4 transition-transform duration-200 ${
                                          isDragging ? "scale-110" : ""
                                        }`}
                                      >
                                        <ImageIcon
                                          className={`w-10 h-10 sm:w-12 sm:h-12 ${
                                            isDragging
                                              ? "text-primary"
                                              : "text-gray-400 dark:text-white/40"
                                          }`}
                                        />
                                      </div>
                                      <p
                                        className={`mb-2 text-xs sm:text-sm text-center ${
                                          isDragging
                                            ? "text-primary font-medium"
                                            : "text-gray-600 dark:text-white/60"
                                        }`}
                                      >
                                        {isDragging ? (
                                          "Drop image here"
                                        ) : (
                                          <>
                                            <span className="font-semibold">
                                              Click to upload
                                            </span>{" "}
                                            or drag and drop
                                          </>
                                        )}
                                      </p>
                                      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-white/40">
                                        PNG, JPG or GIF (MAX. 2MB)
                                      </p>
                                    </div>
                                    <input
                                      id="avatar-upload"
                                      type="file"
                                      className="hidden"
                                      accept="image/*"
                                      onChange={handleFileSelect}
                                    />
                                  </label>
                                </div>
                              )}

                              {/* Upload progress bar */}
                              {isUploading && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-white/60">
                                    <span>Uploading...</span>
                                    <span>{uploadProgress}%</span>
                                  </div>
                                  <div className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                                      style={{ width: `${uploadProgress}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            <DialogFooter className="gap-2 flex-col sm:flex-row">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleAvatarDialogClose(false)}
                                disabled={isUploading}
                                className="w-full sm:w-auto h-8 text-xs"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleUploadAvatar}
                                disabled={!previewUrl || isUploading}
                                className="gap-1.5 w-full sm:w-auto h-8 text-xs"
                              >
                                <Upload className="w-3 h-3" />
                                {isUploading ? "Uploading..." : "Upload"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        {/* Email */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-700 dark:text-white/70 flex items-center gap-1.5">
                            <Mail className="w-3 h-3" />
                            Email Address
                          </Label>
                          <p className="text-xs sm:text-sm text-gray-900 dark:text-white py-1.5 sm:py-2 px-2.5 sm:px-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 break-all">
                            {formData.email}
                          </p>
                        </div>

                        {/* Full Name */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-700 dark:text-white/70 flex items-center gap-1.5">
                            <UserCircle className="w-3 h-3" />
                            Full Name
                          </Label>
                          {isEditing ? (
                            <Input
                              id="full_name"
                              type="text"
                              value={formData.full_name}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  full_name: e.target.value,
                                })
                              }
                              placeholder="Enter your full name"
                              className="h-8 sm:h-9 text-xs sm:text-sm"
                            />
                          ) : (
                            <p className="text-xs sm:text-sm text-gray-900 dark:text-white py-1.5 sm:py-2 px-2.5 sm:px-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
                              {formData.full_name || "-"}
                            </p>
                          )}
                        </div>

                        {/* Username */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-700 dark:text-white/70 flex items-center gap-1.5">
                            <User className="w-3 h-3" />
                            Username
                          </Label>
                          {isEditing ? (
                            <Input
                              id="username"
                              type="text"
                              value={formData.username}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  username: e.target.value,
                                })
                              }
                              placeholder="Enter username"
                              className="h-8 sm:h-9 text-xs sm:text-sm"
                            />
                          ) : (
                            <p className="text-xs sm:text-sm text-gray-900 dark:text-white py-1.5 sm:py-2 px-2.5 sm:px-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
                              {formData.username || "-"}
                            </p>
                          )}
                        </div>

                        {/* Phone */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-700 dark:text-white/70 flex items-center gap-1.5">
                            <Phone className="w-3 h-3" />
                            Phone Number
                          </Label>
                          {isEditing ? (
                            <div className="space-y-1">
                              <Input
                                id="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    phone: e.target.value,
                                  })
                                }
                                placeholder="+14155552671"
                                className="h-8 sm:h-9 text-xs sm:text-sm"
                              />
                              <p className="text-[10px] text-gray-500 dark:text-white/40">
                                Format: +[country code][number] (e.g.,
                                +14155552671)
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs sm:text-sm text-gray-900 dark:text-white py-1.5 sm:py-2 px-2.5 sm:px-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
                              {formData.phone || "-"}
                            </p>
                          )}
                        </div>

                        {/* Action Buttons */}
                        {isEditing && (
                          <div className="flex flex-col sm:flex-row items-center gap-2 pt-3 border-t border-gray-200 dark:border-white/10">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancelEdit}
                              className="w-full sm:w-auto h-8 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1.5 w-full sm:w-auto sm:ml-auto h-8 text-xs"
                              onClick={handleSaveChanges}
                              disabled={isSaving}
                            >
                              <Check className="w-3 h-3" />
                              {isSaving ? "Saving..." : "Save Changes"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </SectionCard>
                </TabsContent>

                {/* Billing Tab */}
                <TabsContent value="billing" className="mt-0">
                  <SectionCard
                    title="Choose Your Plan"
                    useSectionHeader
                    sectionHeaderIcon={CreditCard}
                    sectionHeaderSubtitle="Select the perfect plan for your investment needs"
                  >
                    {/* Pricing Cards */}
                    <div className="px-4 sm:px-6 mt-0 sm:mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
                      {getPricingPlans(profile?.membership || "FREE").map(
                        (plan) => (
                          <PricingCard key={plan.name} {...plan} />
                        )
                      )}
                    </div>
                  </SectionCard>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent
                  value="notifications"
                  className="mt-0 space-y-4 sm:space-y-6"
                >
                  <SectionCard
                    title="Notifications"
                    useSectionHeader
                    sectionHeaderIcon={Bell}
                    sectionHeaderSubtitle="Manage how you receive notifications"
                  >
                    <div className="px-4 pb-4 space-y-4 sm:space-y-5">
                      {/* Newsletter Subscription */}
                      <div>
                        <h3 className="text-xs font-medium mb-2 text-gray-700 dark:text-white/70">
                          Email Notifications
                        </h3>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 sm:p-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors duration-200">
                            <div className="flex-1 space-y-0.5 pr-2">
                              <Label
                                htmlFor="newsletter"
                                className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
                              >
                                Subscribe to Newsletter
                              </Label>
                              <p className="text-[10px] sm:text-xs text-gray-600 dark:text-white/60">
                                Receive market updates, new features, and more
                              </p>
                            </div>
                            <Switch
                              id="newsletter"
                              checked={
                                notificationSettings.is_subscribe_newsletter
                              }
                              onCheckedChange={(checked) =>
                                handleNotificationChange(
                                  "is_subscribe_newsletter",
                                  checked
                                )
                              }
                              className="ml-2 flex-shrink-0"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Notification Method */}
                      <div>
                        <h3 className="text-xs font-medium mb-2 text-gray-700 dark:text-white/70">
                          Notification Method
                        </h3>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-700 dark:text-white/70">
                            Choose your preferred notification method
                          </Label>
                          <Select
                            value={notificationSettings.notification_method}
                            onValueChange={(value: "EMAIL" | "MESSAGE") =>
                              handleNotificationChange(
                                "notification_method",
                                value
                              )
                            }
                          >
                            <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                              <SelectValue placeholder="Select notification method" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EMAIL">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4" />
                                  <span>Email</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="MESSAGE">
                                <div className="flex items-center gap-2">
                                  <Bell className="w-4 h-4" />
                                  <span>In-app Message</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-gray-500 dark:text-white/40">
                            You will receive important system notifications via
                            this method
                          </p>
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                </TabsContent>

                {/* Preferences Tab */}
                <TabsContent
                  value="preferences"
                  className="mt-0 space-y-4 sm:space-y-6"
                >
                  <SectionCard
                    title="Display Preferences"
                    useSectionHeader
                    sectionHeaderIcon={Settings}
                    sectionHeaderSubtitle="Customize your experience"
                  >
                    <div className="px-4 pb-4 space-y-3 sm:space-y-4">
                      {/* Language */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-700 dark:text-white/70 flex items-center gap-1.5">
                          <Globe className="w-3 h-3" />
                          Language
                        </Label>
                        <Select defaultValue="english">
                          <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="english">English</SelectItem>
                            <SelectItem value="zh-cn">Chinese</SelectItem>
                            <SelectItem value="spanish">Spanish</SelectItem>
                            <SelectItem value="french">French</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Theme Selection */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-700 dark:text-white/70 flex items-center gap-1.5">
                          <SunMoon className="w-3 h-3" />
                          Theme Mode
                        </Label>
                        {mounted && (
                          <div className="flex flex-wrap gap-2">
                            {[
                              {
                                value: "light",
                                icon: Sun,
                                label: "Light",
                                description: "Light theme",
                              },
                              {
                                value: "dark",
                                icon: Moon,
                                label: "Dark",
                                description: "Dark theme",
                              },
                              {
                                value: "system",
                                icon: Monitor,
                                label: "System",
                                description: "Follow system",
                              },
                            ].map((mode) => {
                              const Icon = mode.icon;
                              const isActive = theme === mode.value;
                              return (
                                <button
                                  key={mode.value}
                                  onClick={() => handleThemeChange(mode.value)}
                                  className={`w-[100px] flex flex-col items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg border-2 transition-all duration-200 ${
                                    isActive
                                      ? "border-primary bg-primary/5 dark:bg-primary/10"
                                      : "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10"
                                  }`}
                                >
                                  <div
                                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors ${
                                      isActive
                                        ? "bg-primary text-white"
                                        : "dark:bg-card-dark text-gray-600 dark:text-white/70"
                                    }`}
                                  >
                                    <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                                  </div>
                                  <div className="text-center">
                                    <p
                                      className={`font-medium text-[10px] sm:text-xs ${
                                        isActive
                                          ? "text-primary"
                                          : "text-gray-900 dark:text-white"
                                      }`}
                                    >
                                      {mode.label}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {/* Data Display */}
                      <div>
                        <h3 className="text-xs font-medium mb-2 text-gray-700 dark:text-white/70">
                          Data Display
                        </h3>
                        <div className="space-y-2">
                          {[
                            {
                              id: "percentage-change",
                              label: "Show percentage change",
                              description:
                                "Display price changes as percentages",
                            },
                            {
                              id: "auto-refresh",
                              label: "Auto-refresh data",
                              description:
                                "Automatically refresh market data every 30 seconds",
                            },
                            {
                              id: "compact-view",
                              label: "Compact view",
                              description: "Show more data in less space",
                            },
                          ].map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-2 sm:p-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors duration-200"
                            >
                              <div className="flex-1 space-y-0.5 pr-2">
                                <Label
                                  htmlFor={item.id}
                                  className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
                                >
                                  {item.label}
                                </Label>
                                <p className="text-[10px] sm:text-xs text-gray-600 dark:text-white/60">
                                  {item.description}
                                </p>
                              </div>
                              <Switch
                                id={item.id}
                                defaultChecked
                                className="ml-2 flex-shrink-0"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
