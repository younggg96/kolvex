"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import Image from "next/image";
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
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import SectionCard from "@/components/SectionCard";
import PricingCard from "@/components/PricingCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useAuth, useUserProfile } from "@/hooks";
import {
  updateTheme as updateThemeDb,
  updateUserProfile,
} from "@/lib/supabase/api/users";
import type { Theme as ThemeType } from "@/lib/supabase/database.types";
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
    isLoading: profileLoading,
    refresh: refreshProfile,
  } = useUserProfile();

  const [activeTab, setActiveTab] = useState("account");
  const [mounted, setMounted] = useState(false);

  // Profile editing state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    phone: "",
  });

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState({
    priceAlerts: true,
    marketNews: true,
    portfolioUpdates: true,
    breakingNews: true,
    tradeConfirmations: true,
  });

  // Load profile data into form
  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || "",
        email: profile.email || "",
        phone: profile.phone_e164 || "",
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

    if (user && profile) {
      // Update theme in database
      const themeValue = newTheme.toUpperCase() as ThemeType;
      await updateThemeDb(user.id, themeValue);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadAvatar = async () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);
    try {
      const supabase = createClient();
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("user-uploads")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("user-uploads").getPublicUrl(filePath);

      const result = await updateUserProfile(user.id, {
        avatar_url: publicUrl,
      });

      if (result.success) {
        toast.success("Avatar updated successfully");
        await refreshProfile();
        setAvatarDialogOpen(false);
        setSelectedFile(null);
        setPreviewUrl(null);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload avatar");
    } finally {
      setIsUploading(false);
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
      const result = await updateUserProfile(user.id, {
        username: formData.username || null,
        phone_e164:
          formData.phone && formData.phone.trim() !== ""
            ? formData.phone
            : null,
      });

      if (result.success) {
        toast.success("Profile updated successfully");
        await refreshProfile();
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
        email: profile.email || "",
        phone: profile.phone_e164 || "",
      });
    }
    setIsEditing(false);
  };

  const handleNotificationChange = async (
    key: keyof typeof notificationSettings,
    value: boolean
  ) => {
    setNotificationSettings((prev) => ({ ...prev, [key]: value }));

    // TODO: Save to database when notification settings are mapped to database fields
    // For now, just update local state
  };

  return (
    <DashboardLayout title="Settings">
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 min-w-0">
          {/* Settings Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <div className="flex flex-col md:flex-row gap-2">
              {/* Vertical Tab List (Tablet/Desktop) / Horizontal Tab List (Mobile) */}
              <div className="w-full md:w-48 flex-shrink-0">
                {/* Mobile: Horizontal scrolling tabs */}
                <TabsList className="h-auto rounded-lg flex md:hidden flex-row items-center gap-1.5 bg-white dark:bg-card-dark border border-border-light dark:border-border-dark p-1.5 overflow-x-auto scrollbar-hide">
                  {settingsTabs.map((tab) => {
                    const isActive = activeTab === tab.value;
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "text-gray-600 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white/70"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {/* Tablet/Desktop: Vertical tabs */}
                <TabsList className="hidden md:flex h-auto flex-col items-stretch gap-1 bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg p-2 sticky top-0">
                  {settingsTabs.map((tab) => {
                    const isActive = activeTab === tab.value;
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className={`w-full flex items-center justify-start gap-2 px-2.5 h-9 rounded-lg text-xs font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "text-gray-600 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white/70"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="flex-1 text-left">{tab.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

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
                        {/* Avatar */}
                        <Dialog
                          open={avatarDialogOpen}
                          onOpenChange={setAvatarDialogOpen}
                        >
                          <div className="flex items-center gap-3 sm:gap-4 p-2 sm:p-3">
                            <div className="relative">
                              {profile?.avatar_url ? (
                                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shadow-lg">
                                  <Image
                                    src={profile.avatar_url}
                                    alt="Profile"
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 640px) 64px, 80px"
                                  />
                                </div>
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
                              <DialogTrigger asChild>
                                <button className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 bg-white dark:bg-card-dark rounded-full flex items-center justify-center shadow-md border-2 border-gray-200 dark:border-white/10 hover:scale-110 transition-all duration-200 cursor-pointer">
                                  <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-600 dark:text-white/70" />
                                </button>
                              </DialogTrigger>
                            </div>
                          </div>

                          <DialogContent className="w-[calc(100%-2rem)] max-w-md mx-auto">
                            <DialogHeader>
                              <DialogTitle className="text-base sm:text-lg">
                                Upload Avatar
                              </DialogTitle>
                              <DialogDescription className="text-xs sm:text-sm">
                                Choose an image file to upload as your profile
                                picture.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="flex items-center justify-center w-full">
                                <label
                                  htmlFor="avatar-upload"
                                  className="flex flex-col items-center justify-center w-full h-48 sm:h-64 border-2 border-gray-300 dark:border-white/10 border-dashed rounded-xl cursor-pointer bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors duration-200"
                                >
                                  {previewUrl ? (
                                    <div className="relative w-full h-full p-3 sm:p-4">
                                      <div className="relative w-full h-full">
                                        <Image
                                          src={previewUrl}
                                          alt="Preview"
                                          fill
                                          className="object-cover rounded-lg"
                                          sizes="(max-width: 640px) 300px, 400px"
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center pt-4 pb-5 sm:pt-5 sm:pb-6 px-4">
                                      <ImageIcon className="w-10 h-10 sm:w-12 sm:h-12 mb-3 sm:mb-4 text-gray-400 dark:text-white/40" />
                                      <p className="mb-2 text-xs sm:text-sm text-gray-600 dark:text-white/60 text-center">
                                        <span className="font-semibold">
                                          Click to upload
                                        </span>{" "}
                                        or drag and drop
                                      </p>
                                      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-white/40">
                                        PNG, JPG or GIF (MAX. 2MB)
                                      </p>
                                    </div>
                                  )}
                                  <input
                                    id="avatar-upload"
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                  />
                                </label>
                              </div>
                            </div>
                            <DialogFooter className="gap-2 flex-col sm:flex-row">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setAvatarDialogOpen(false);
                                  setSelectedFile(null);
                                  setPreviewUrl(null);
                                }}
                                className="w-full sm:w-auto h-8 text-xs"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleUploadAvatar}
                                disabled={!selectedFile || isUploading}
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
                      {/* Email Notifications */}
                      <div>
                        <h3 className="text-xs font-medium mb-2 text-gray-700 dark:text-white/70">
                          Email Notifications
                        </h3>
                        <div className="space-y-2">
                          {[
                            {
                              id: "price-alerts",
                              label: "Price Alerts",
                              description:
                                "Get notified when your watchlist stocks hit target prices",
                            },
                            {
                              id: "market-news",
                              label: "Market News",
                              description:
                                "Receive daily market news and analysis",
                            },
                            {
                              id: "portfolio-updates",
                              label: "Portfolio Updates",
                              description:
                                "Weekly summary of your portfolio performance",
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

                      {/* Push Notifications */}
                      <div>
                        <h3 className="text-xs font-medium mb-2 text-gray-700 dark:text-white/70">
                          Push Notifications
                        </h3>
                        <div className="space-y-2">
                          {[
                            {
                              id: "breaking-news",
                              label: "Breaking News",
                              description:
                                "Instant alerts for major market events",
                            },
                            {
                              id: "trade-confirmations",
                              label: "Trade Confirmations",
                              description:
                                "Notifications when trades are executed",
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
