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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation, SUPPORTED_LOCALES } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
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
  type UserProfileUpdate,
} from "@/lib/api/userApi";
import {
  getUserApiKeys,
  upsertUserApiKey,
  deleteUserApiKey,
  PROVIDER_INFO,
  type UserApiKey,
} from "@/lib/api/userApiKeysApi";

function SettingsSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-2">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <h2 className="text-[22px] font-bold leading-tight text-foreground">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function FieldRow({
  icon: Icon,
  label,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 border-b border-border py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:gap-6">
      <Label className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </Label>
      <div className="min-w-0 text-[15px] text-foreground">{children}</div>
    </div>
  );
}

const settingsTabDefs = [
  { value: "account", icon: User, labelKey: "settings.tabs.account" },
  { value: "api-keys", icon: Key, labelKey: "settings.tabs.apiKeys" },
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
        <div className="mx-auto w-full min-w-0 max-w-[760px] px-4 pb-16 pt-6 md:px-8 md:pt-8">
          {/* Settings Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <div className="flex flex-col gap-8">
              <TabsList aria-label={t("settings.title")}>
                {tabOptions.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Tab Content Area */}
              <div className="flex-1 min-w-0">
                {/* Account Info Tab */}
                <TabsContent value="account" className="mt-0">
                  <SettingsSection
                    title={t("settings.account.title")}
                    subtitle={
                      isEditing
                        ? t("settings.account.updateDetails")
                        : t("settings.account.viewDetails")
                    }
                    action={
                      !isEditing && !profileLoading ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditing(true)}
                          className="gap-1.5"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          {t("common.edit")}
                        </Button>
                      ) : undefined
                    }
                  >
                    {profileLoading ? (
                      <ProfileInfoSkeleton />
                    ) : (
                      <div>
                        {/* Avatar with fullscreen preview */}
                        <div className="flex items-center gap-4 border-b border-border py-5">
                          <div className="relative">
                            {profile?.avatar_url ? (
                              <button
                                onClick={() => setAvatarPreviewOpen(true)}
                                aria-label={t("settings.account.uploadAvatar")}
                                className="group relative h-[72px] w-[72px] cursor-pointer overflow-hidden rounded-full"
                              >
                                <Image
                                  src={profile.avatar_url}
                                  alt="Profile"
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 640px) 64px, 80px"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-150 group-hover:bg-black/30">
                                  <Maximize2 className="h-5 w-5 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                                </div>
                              </button>
                            ) : (
                              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                                {profile?.email
                                  ?.substring(0, 2)
                                  .toUpperCase() || "US"}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => setAvatarDialogOpen(true)}
                              aria-label={t("settings.account.uploadAvatar")}
                              className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-foreground text-background transition-transform duration-150 hover:scale-105"
                            >
                              <Camera className="h-3.5 w-3.5" />
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
                                  <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
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
                                    <ZoomOut className="h-4 w-4 text-muted-foreground" />
                                    <input
                                      type="range"
                                      min={1}
                                      max={3}
                                      step={0.1}
                                      value={zoom}
                                      onChange={(e) =>
                                        setZoom(Number(e.target.value))
                                      }
                                      aria-label="Zoom"
                                      className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                                    />
                                    <ZoomIn className="h-4 w-4 text-muted-foreground" />
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
                                        ? "border-foreground bg-muted"
                                        : "border-border bg-muted/60 hover:bg-muted"
                                      }`}
                                  >
                                    <div className="flex flex-col items-center justify-center pt-4 pb-5 sm:pt-5 sm:pb-6 px-4">
                                      <div
                                        className={`mb-3 sm:mb-4 transition-transform duration-200 ${isDragging ? "scale-110" : ""
                                          }`}
                                      >
                                        <ImageIcon
                                          className={`w-10 h-10 sm:w-12 sm:h-12 ${isDragging
                                              ? "text-foreground"
                                              : "text-muted-foreground"
                                            }`}
                                        />
                                      </div>
                                      <p
                                        className={`mb-2 text-xs sm:text-sm text-center ${isDragging
                                            ? "font-medium text-foreground"
                                            : "text-muted-foreground"
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
                                      <p className="text-xs text-muted-foreground">
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
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{t("common.uploading")}</span>
                                    <span>{uploadProgress}%</span>
                                  </div>
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
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

                        <FieldRow icon={Mail} label={t("settings.account.emailAddress")}>
                          <p className="break-all">{formData.email}</p>
                        </FieldRow>

                        <FieldRow icon={UserCircle} label={t("settings.account.fullName")}>
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
                            />
                          ) : (
                            <p>{formData.full_name || "—"}</p>
                          )}
                        </FieldRow>

                        <FieldRow icon={Phone} label={t("settings.account.phoneNumber")}>
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
                              />
                              <p className="text-xs text-muted-foreground">
                                {t("settings.account.phoneFormat")}
                              </p>
                            </div>
                          ) : (
                            <p className="figure">{formData.phone || "—"}</p>
                          )}
                        </FieldRow>

                        {/* Action Buttons */}
                        {isEditing && (
                          <div className="flex flex-col-reverse items-center gap-2 pt-5 sm:flex-row sm:justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancelEdit}
                              className="w-full sm:w-auto"
                            >
                              {t("common.cancel")}
                            </Button>
                            <Button
                              size="sm"
                              className="w-full gap-1.5 sm:w-auto"
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
                  </SettingsSection>
                </TabsContent>

                {/* API Keys Tab */}
                <TabsContent value="api-keys" className="mt-0">
                  <SettingsSection
                    title={t("settings.apiKeys.title")}
                    subtitle={t("settings.apiKeys.subtitle")}
                  >
                    <div>
                      {apiKeysLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-sm text-muted-foreground">{t("common.loading")}</span>
                        </div>
                      ) : (
                        <>
                          {/* Info banner */}
                          <div className="mt-4 rounded-2xl bg-muted px-4 py-3">
                            <p className="text-[13px] leading-5 text-muted-foreground">
                              {t("settings.apiKeys.infoBanner")}
                            </p>
                          </div>

                          {/* Provider list */}
                          <div className="divide-y divide-border">
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
                                  className="py-5"
                                >
                                  {/* Provider header */}
                                  <div className="mb-3 flex items-start justify-between gap-4">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h3 className="text-[15px] font-semibold text-foreground">
                                          {info.name}
                                        </h3>
                                        {existingKey && (
                                          <span className="rounded-full bg-positive/10 px-2 py-0.5 text-[11px] font-semibold text-positive">
                                            {t("common.configured")}
                                          </span>
                                        )}
                                      </div>
                                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                                        {info.description}
                                      </p>
                                    </div>
                                    <a
                                      href={info.docsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex flex-shrink-0 items-center gap-1 text-[13px] font-semibold text-positive hover:underline"
                                    >
                                      {t("settings.apiKeys.getKey")}
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>

                                  {/* Existing key display */}
                                  {existingKey && (
                                    <div className="flex items-center gap-2 mb-2">
                                      <code className="flex-1 truncate rounded-xl bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                                        {existingKey.api_key_masked}
                                      </code>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteApiKey(provider)}
                                        disabled={isDeleting}
                                        aria-label={`${t("common.delete")} ${info.name}`}
                                        className="h-9 w-9 flex-shrink-0 rounded-full p-0 text-negative hover:bg-negative/10 hover:text-negative"
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
                                        aria-label={`${info.name} API key`}
                                        className="pr-10 font-mono text-[13px]"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setApiKeyVisible((prev) => ({
                                            ...prev,
                                            [provider]: !prev[provider],
                                          }))
                                        }
                                        aria-label={isVisible ? "Hide key" : "Show key"}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                                      className="flex-shrink-0"
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
                  </SettingsSection>
                </TabsContent>

                {/* Preferences Tab */}
                <TabsContent
                  value="preferences"
                  className="mt-0"
                >
                  <SettingsSection
                    title={t("settings.preferences.title")}
                    subtitle={t("settings.preferences.subtitle")}
                  >
                    <div>
                      <FieldRow icon={Globe} label={t("settings.preferences.language")}>
                        <Select value={locale} onValueChange={handleLanguageChange}>
                          <SelectTrigger className="w-full sm:w-[280px]" aria-label={t("settings.preferences.language")}>
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
                      </FieldRow>
                      <FieldRow icon={SunMoon} label={t("settings.preferences.theme")}>
                        {mounted && (
                          <div role="radiogroup" aria-label={t("settings.preferences.theme")} className="inline-flex flex-wrap gap-1 rounded-full bg-muted p-1">
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
                                  type="button"
                                  role="radio"
                                  aria-checked={isActive}
                                  title={mode.description}
                                  onClick={() => handleThemeChange(mode.value)}
                                  className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isActive
                                      ? "bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.12)]"
                                      : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                  <Icon className="h-4 w-4" />
                                  {mode.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </FieldRow>
                    </div>
                  </SettingsSection>
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
