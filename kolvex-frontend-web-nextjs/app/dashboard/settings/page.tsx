"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import Image from "next/image";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import {
  Bell,
  Settings,
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
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SectionCard from "@/components/layout/SectionCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation, SUPPORTED_LOCALES } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
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
import { ProfileInfoSkeleton } from "@/components/common/LoadingSkeleton";
import {
  useCurrentUserProfile,
  updateUserTheme,
  updateUserNotifications,
  type UserProfileUpdate,
} from "@/lib/api/userApi";
import {
  getUserApiKeys,
  upsertUserApiKey,
  deleteUserApiKey,
  PROVIDER_INFO,
  type UserApiKey,
} from "@/lib/api/userApiKeysApi";

const settingsTabDefs = [
  { value: "account", icon: User, labelKey: "settings.tabs.account" },
  { value: "api-keys", icon: Key, labelKey: "settings.tabs.apiKeys" },
  { value: "notifications", icon: Bell, labelKey: "settings.tabs.notifications" },
  { value: "preferences", icon: Settings, labelKey: "settings.tabs.preferences" },
];

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const { user, isLoading: authLoading } = useAuth();
  const { t, locale, setLocale } = useTranslation();
  const {
    profile,
    loading: profileLoading,
    updateProfile,
    updateTheme: updateProfileTheme,
    updateLocale: updateProfileLocale,
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
    full_name: "",
    email: "",
    phone: "",
  });

  // Notification settings state - simplified to just enabled/disabled
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<UserApiKey[]>([]);
  const [supportedProviders, setSupportedProviders] = useState<string[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [apiKeySaving, setApiKeySaving] = useState<string | null>(null); // provider being saved
  const [apiKeyDeleting, setApiKeyDeleting] = useState<string | null>(null);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [apiKeyVisible, setApiKeyVisible] = useState<Record<string, boolean>>({});

  const loadApiKeys = useCallback(async () => {
    setApiKeysLoading(true);
    try {
      const data = await getUserApiKeys();
      setApiKeys(data.keys);
      setSupportedProviders(data.supported_providers);
    } catch (error: any) {
      console.error("Failed to load API keys:", error);
    } finally {
      setApiKeysLoading(false);
    }
  }, []);

  // Load API keys when switching to the tab
  useEffect(() => {
    if (activeTab === "api-keys") {
      loadApiKeys();
    }
  }, [activeTab, loadApiKeys]);

  const handleSaveApiKey = async (provider: string) => {
    const key = apiKeyInputs[provider]?.trim();
    if (!key) return;

    setApiKeySaving(provider);
    try {
      await upsertUserApiKey(provider, key);
      toast.success(t("settings.apiKeys.keySaved", { provider: PROVIDER_INFO[provider]?.name || provider }));
      setApiKeyInputs((prev) => ({ ...prev, [provider]: "" }));
      await loadApiKeys();
    } catch (error: any) {
      toast.error(error.message || t("settings.apiKeys.failedToSave"));
    } finally {
      setApiKeySaving(null);
    }
  };

  const handleDeleteApiKey = async (provider: string) => {
    setApiKeyDeleting(provider);
    try {
      await deleteUserApiKey(provider);
      toast.success(t("settings.apiKeys.keyRemoved", { provider: PROVIDER_INFO[provider]?.name || provider }));
      await loadApiKeys();
    } catch (error: any) {
      toast.error(error.message || t("settings.apiKeys.failedToDelete"));
    } finally {
      setApiKeyDeleting(null);
    }
  };

  // Load profile data into form
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        email: profile.email || "",
        phone: profile.phone_e164 || "",
      });
      setEmailNotificationsEnabled(profile.email_notifications_enabled ?? true);
    }
  }, [profile]);

  useEffect(() => {
    setMounted(true);

    // Get tab from URL
    const tab = searchParams.get("tab");
    const validTab = settingsTabDefs.some((definition) => definition.value === tab);
    setActiveTab(validTab && tab ? tab : "account");
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
        toast.error(t("settings.preferences.failedToUpdateTheme"));
      }
    }
  };

  const processFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("settings.account.fileSizeError"));
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error(t("settings.account.fileTypeError"));
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

      // Upload via backend API
      const formData = new FormData();
      formData.append("file", croppedBlob, `avatar-${Date.now()}.jpg`);

      const uploadResponse = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(90);

      const uploadResult = await uploadResponse.json();

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "Failed to upload avatar");
      }

      // Update profile with new avatar URL
      const result = await updateProfile({
        avatar_url: uploadResult.url,
      });

      setUploadProgress(100);

      if (result.success) {
        toast.success(t("settings.account.avatarUpdated"));
        handleAvatarDialogClose(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || t("settings.account.failedToUpload"));
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
        toast.error(t("settings.account.phoneFormatError"));
        return;
      }
    }

    setIsSaving(true);
    try {
      const updates: UserProfileUpdate = {
        full_name: formData.full_name || undefined,
        phone_e164:
          formData.phone && formData.phone.trim() !== ""
            ? formData.phone
            : undefined,
      };

      const result = await updateProfile(updates);

      if (result.success) {
        toast.success(t("settings.account.profileUpdated"));
        setIsEditing(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error("Save error:", error);
      if (error.message?.includes("chk_phone_format")) {
        toast.error(t("settings.account.phoneFormatError"));
      } else {
        toast.error(error.message || t("settings.account.failedToUpdate"));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        email: profile.email || "",
        phone: profile.phone_e164 || "",
      });
    }
    setIsEditing(false);
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    const previousValue = emailNotificationsEnabled;
    setEmailNotificationsEnabled(enabled);

    // Update via backend API
    try {
      const result = await updateNotifications({ email_notifications_enabled: enabled });

      if (result.success) {
        toast.success(enabled ? t("settings.notifications.enabled") : t("settings.notifications.disabled"));
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error("Notification update error:", error);
      toast.error(error.message || t("settings.notifications.failedToUpdate"));
      // Revert on error
      setEmailNotificationsEnabled(previousValue);
    }
  };

  const handleLanguageChange = async (newLocale: string) => {
    setLocale(newLocale as Locale);
    const langName = SUPPORTED_LOCALES.find((l) => l.value === newLocale)?.nativeLabel || newLocale;
    toast.success(t("settings.preferences.languageChanged", { language: langName }));

    // Persist to Supabase if user is authenticated
    if (profile) {
      const result = await updateProfileLocale(newLocale as "en" | "zh");
      if (!result.success) {
        console.error("Failed to save locale to server:", result.error);
      }
    }
  };

  const tabOptions = settingsTabDefs.map((tab) => ({
    value: tab.value,
    label: t(tab.labelKey),
    icon: <tab.icon className="w-4 h-4" />,
  }));

  return (
    <DashboardLayout title={t("settings.title")}>
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
                    title={t("settings.account.title")}
                    useSectionHeader
                    sectionHeaderIcon={User}
                    sectionHeaderSubtitle={
                      isEditing
                        ? t("settings.account.updateDetails")
                        : t("settings.account.viewDetails")
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
                          {t("common.edit")}
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
                                {profile?.email
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
                                {t("settings.account.uploadAvatar")}
                              </DialogTitle>
                              <DialogDescription className="text-xs sm:text-sm">
                                {previewUrl
                                  ? t("settings.account.avatarCropDescription")
                                  : t("settings.account.avatarDescription")}
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
                                      {t("common.reset")}
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
                                        {t("settings.account.changeImage")}
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
                                    className={`flex flex-col items-center justify-center w-full h-48 sm:h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${isDragging
                                        ? "border-primary bg-primary/10 dark:bg-primary/20 scale-[1.02]"
                                        : "border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10"
                                      }`}
                                  >
                                    <div className="flex flex-col items-center justify-center pt-4 pb-5 sm:pt-5 sm:pb-6 px-4">
                                      <div
                                        className={`mb-3 sm:mb-4 transition-transform duration-200 ${isDragging ? "scale-110" : ""
                                          }`}
                                      >
                                        <ImageIcon
                                          className={`w-10 h-10 sm:w-12 sm:h-12 ${isDragging
                                              ? "text-primary"
                                              : "text-gray-400 dark:text-white/40"
                                            }`}
                                        />
                                      </div>
                                      <p
                                        className={`mb-2 text-xs sm:text-sm text-center ${isDragging
                                            ? "text-primary font-medium"
                                            : "text-gray-600 dark:text-white/60"
                                          }`}
                                      >
                                        {isDragging ? (
                                          t("settings.account.dropImageHere")
                                        ) : (
                                          <>
                                            <span className="font-semibold">
                                              {t("settings.account.clickToUpload")}
                                            </span>{" "}
                                            {t("settings.account.orDragAndDrop")}
                                          </>
                                        )}
                                      </p>
                                      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-white/40">
                                        {t("settings.account.imageFormats")}
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
                                    <span>{t("common.uploading")}</span>
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
                                {t("common.cancel")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleUploadAvatar}
                                disabled={!previewUrl || isUploading}
                                className="gap-1.5 w-full sm:w-auto h-8 text-xs"
                              >
                                <Upload className="w-3 h-3" />
                                {isUploading ? t("common.uploading") : t("settings.account.upload")}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        {/* Email */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-700 dark:text-white/70 flex items-center gap-1.5">
                            <Mail className="w-3 h-3" />
                            {t("settings.account.emailAddress")}
                          </Label>
                          <p className="text-xs sm:text-sm text-gray-900 dark:text-white py-1.5 sm:py-2 px-2.5 sm:px-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 break-all">
                            {formData.email}
                          </p>
                        </div>

                        {/* Full Name */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-700 dark:text-white/70 flex items-center gap-1.5">
                            <UserCircle className="w-3 h-3" />
                            {t("settings.account.fullName")}
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
                              placeholder={t("settings.account.enterFullName")}
                              className="h-8 sm:h-9 text-xs sm:text-sm"
                            />
                          ) : (
                            <p className="text-xs sm:text-sm text-gray-900 dark:text-white py-1.5 sm:py-2 px-2.5 sm:px-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
                              {formData.full_name || "-"}
                            </p>
                          )}
                        </div>
                        {/* Phone */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-700 dark:text-white/70 flex items-center gap-1.5">
                            <Phone className="w-3 h-3" />
                            {t("settings.account.phoneNumber")}
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
                                {t("settings.account.phoneFormat")}
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
                              {t("common.cancel")}
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1.5 w-full sm:w-auto sm:ml-auto h-8 text-xs"
                              onClick={handleSaveChanges}
                              disabled={isSaving}
                            >
                              <Check className="w-3 h-3" />
                              {isSaving ? t("common.saving") : t("settings.account.saveChanges")}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </SectionCard>
                </TabsContent>

                {/* API Keys Tab */}
                <TabsContent value="api-keys" className="mt-0">
                  <SectionCard
                    title={t("settings.apiKeys.title")}
                    useSectionHeader
                    sectionHeaderIcon={Key}
                    sectionHeaderSubtitle={t("settings.apiKeys.subtitle")}
                  >
                    <div className="px-4 pb-4 space-y-3">
                      {apiKeysLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-sm text-muted-foreground">{t("common.loading")}</span>
                        </div>
                      ) : (
                        <>
                          {/* Info banner */}
                          <div className="p-3 rounded-lg bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30">
                            <p className="text-xs text-primary dark:text-primary-foreground">
                              {t("settings.apiKeys.infoBanner")}
                            </p>
                          </div>

                          {/* Provider list */}
                          <div className="space-y-3">
                            {(supportedProviders.length > 0
                              ? supportedProviders
                              : Object.keys(PROVIDER_INFO)
                            ).map((provider) => {
                              const info = PROVIDER_INFO[provider];
                              const existingKey = apiKeys.find(
                                (k) => k.provider === provider
                              );
                              const isSaving = apiKeySaving === provider;
                              const isDeleting = apiKeyDeleting === provider;
                              const inputValue = apiKeyInputs[provider] || "";
                              const isVisible = apiKeyVisible[provider] || false;

                              if (!info) return null;

                              return (
                                <div
                                  key={provider}
                                  className="p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors"
                                >
                                  {/* Provider header */}
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                          {info.name}
                                        </h4>
                                        {existingKey && (
                                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">
                                            {t("common.configured")}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-gray-500 dark:text-white/50 mt-0.5">
                                        {info.description}
                                      </p>
                                    </div>
                                    <a
                                      href={info.docsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 flex-shrink-0"
                                    >
                                      {t("settings.apiKeys.getKey")}
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>

                                  {/* Existing key display */}
                                  {existingKey && (
                                    <div className="flex items-center gap-2 mb-2">
                                      <code className="flex-1 text-xs px-2.5 py-1.5 rounded bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-white/60 font-mono truncate">
                                        {existingKey.api_key_masked}
                                      </code>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteApiKey(provider)}
                                        disabled={isDeleting}
                                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex-shrink-0"
                                      >
                                        {isDeleting ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Trash2 className="w-3.5 h-3.5" />
                                        )}
                                      </Button>
                                    </div>
                                  )}

                                  {/* Input for new / replacement key */}
                                  <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                      <Input
                                        type={isVisible ? "text" : "password"}
                                        placeholder={existingKey ? t("settings.apiKeys.replaceKey") : info.placeholder}
                                        value={inputValue}
                                        onChange={(e) =>
                                          setApiKeyInputs((prev) => ({
                                            ...prev,
                                            [provider]: e.target.value,
                                          }))
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && inputValue.trim()) {
                                            handleSaveApiKey(provider);
                                          }
                                        }}
                                        className="h-8 text-xs pr-8 font-mono"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setApiKeyVisible((prev) => ({
                                            ...prev,
                                            [provider]: !prev[provider],
                                          }))
                                        }
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white/60"
                                      >
                                        {isVisible ? (
                                          <EyeOff className="w-3.5 h-3.5" />
                                        ) : (
                                          <Eye className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                    <Button
                                      size="sm"
                                      onClick={() => handleSaveApiKey(provider)}
                                      disabled={!inputValue.trim() || isSaving}
                                      className="h-8 text-xs px-3 flex-shrink-0"
                                    >
                                      {isSaving ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        t("common.save")
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
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
                    title={t("settings.notifications.title")}
                    useSectionHeader
                    sectionHeaderIcon={Bell}
                    sectionHeaderSubtitle={t("settings.notifications.subtitle")}
                  >
                    <div className="px-4 pb-4 space-y-4 sm:space-y-5">
                      {/* Email Notifications Toggle */}
                      <div>
                        <h3 className="text-xs font-medium mb-2 text-gray-700 dark:text-white/70">
                          {t("settings.notifications.emailNotifications")}
                        </h3>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 sm:p-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors duration-200">
                            <div className="flex-1 space-y-0.5 pr-2">
                              <Label
                                htmlFor="email-notifications"
                                className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
                              >
                                {t("settings.notifications.enableEmail")}
                              </Label>
                              <p className="text-[10px] sm:text-xs text-gray-600 dark:text-white/60">
                                {t("settings.notifications.emailDescription")}
                              </p>
                            </div>
                            <Switch
                              id="email-notifications"
                              checked={emailNotificationsEnabled}
                              onCheckedChange={handleNotificationToggle}
                              className="ml-2 flex-shrink-0"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-white/40 mt-2">
                          {t("settings.notifications.emailHint")}
                        </p>
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
                    title={t("settings.preferences.title")}
                    useSectionHeader
                    sectionHeaderIcon={Settings}
                    sectionHeaderSubtitle={t("settings.preferences.subtitle")}
                  >
                    <div className="px-4 pb-4 space-y-3 sm:space-y-4">
                      {/* Language */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-700 dark:text-white/70">
                          {t("settings.preferences.language")}
                        </Label>
                        <Select value={locale} onValueChange={handleLanguageChange}>
                          <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm w-full sm:w-[400px]">
                            <SelectValue placeholder={t("settings.preferences.selectLanguage")} />
                          </SelectTrigger>
                          <SelectContent>
                            {SUPPORTED_LOCALES.map((lang) => (
                              <SelectItem key={lang.value} value={lang.value}>
                                {lang.nativeLabel} ({lang.label})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Theme Selection */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-700 dark:text-white/70 flex items-center gap-1.5">
                          {t("settings.preferences.theme")}
                        </Label>
                        {mounted && (
                          <div className="flex flex-wrap gap-2">
                            {[
                              {
                                value: "light",
                                icon: Sun,
                                label: t("settings.preferences.themeLight"),
                                description: t("settings.preferences.themeLightDesc"),
                              },
                              {
                                value: "dark",
                                icon: Moon,
                                label: t("settings.preferences.themeDark"),
                                description: t("settings.preferences.themeDarkDesc"),
                              },
                              {
                                value: "system",
                                icon: Monitor,
                                label: t("settings.preferences.themeSystem"),
                                description: t("settings.preferences.themeSystemDesc"),
                              },
                            ].map((mode) => {
                              const Icon = mode.icon;
                              const isActive = theme === mode.value;
                              return (
                                <button
                                  key={mode.value}
                                  onClick={() => handleThemeChange(mode.value)}
                                  className={`w-[100px] flex flex-col items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg border-2 transition-all duration-200 ${isActive
                                      ? "border-primary bg-primary/5 dark:bg-primary/10"
                                      : "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10"
                                    }`}
                                >
                                  <div
                                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors ${isActive
                                        ? "bg-primary text-white"
                                        : "dark:bg-card-dark text-gray-600 dark:text-white/70"
                                      }`}
                                  >
                                    <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                                  </div>
                                  <div className="text-center">
                                    <p
                                      className={`font-medium text-[10px] sm:text-xs ${isActive
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
