/**
 * 用户资料设置组件
 * 展示如何使用用户 API
 */
"use client";

import { useState, useEffect } from "react";
import { useCurrentUserProfile } from "@/lib/api/userApi";
import type { UserProfileUpdate } from "@/lib/api/userApi";

export default function UserProfileSettings() {
  const {
    profile,
    loading,
    error,
    updateProfile,
    updateTheme,
  } = useCurrentUserProfile();

  // 表单状态
  const [formData, setFormData] = useState<UserProfileUpdate>({
    username: "",
    full_name: "",
    phone_e164: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 当用户资料加载完成后，填充表单
  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || "",
        full_name: profile.full_name || "",
        phone_e164: profile.phone_e164 || "",
      });
    }
  }, [profile]);

  // 处理表单输入
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // 提交更新
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const result = await updateProfile(formData);

    if (result.success) {
      setMessage({ type: "success", text: "资料更新成功！" });
    } else {
      setMessage({ type: "error", text: result.error || "更新失败" });
    }

    setIsSubmitting(false);
  };

  // 更新主题
  const handleThemeChange = async (theme: "LIGHT" | "DARK" | "SYSTEM") => {
    const result = await updateTheme(theme);

    if (result.success) {
      setMessage({ type: "success", text: "主题已更新！" });
    } else {
      setMessage({ type: "error", text: result.error || "主题更新失败" });
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-negative/10 border border-negative/30 rounded-lg p-4">
          <h3 className="text-negative font-semibold">加载失败</h3>
          <p className="text-negative mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">个人设置</h1>

      {/* 消息提示 */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-positive/10 border border-positive/30 text-positive"
              : "bg-negative/10 border border-negative/30 text-negative"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 基本信息 */}
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">基本信息</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              邮箱
            </label>
            <input
              type="email"
              value={profile?.email || ""}
              disabled
              className="w-full px-4 py-2 border border-border rounded-lg bg-muted"
            />
            <p className="text-sm text-muted-foreground mt-1">邮箱无法修改</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              用户名
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="输入用户名"
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              全名
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              placeholder="输入全名"
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              手机号
            </label>
            <input
              type="tel"
              name="phone_e164"
              value={formData.phone_e164}
              onChange={handleInputChange}
              placeholder="+1234567890"
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-muted-foreground mt-1">
              请使用 E.164 格式（如 +1234567890）
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-full font-semibold hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isSubmitting ? "保存中..." : "保存更改"}
          </button>
        </form>
      </section>

      {/* 主题设置 */}
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">主题设置</h2>

        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => handleThemeChange("LIGHT")}
            className={`p-4 border-2 rounded-lg transition ${
              profile?.theme === "LIGHT"
                ? "border-border bg-muted"
                : "border-border hover:border-border"
            }`}
          >
            <div className="text-center">
              <div className="text-3xl mb-2">☀️</div>
              <div className="font-medium">浅色</div>
            </div>
          </button>

          <button
            onClick={() => handleThemeChange("DARK")}
            className={`p-4 border-2 rounded-lg transition ${
              profile?.theme === "DARK"
                ? "border-border bg-muted"
                : "border-border hover:border-border"
            }`}
          >
            <div className="text-center">
              <div className="text-3xl mb-2">🌙</div>
              <div className="font-medium">深色</div>
            </div>
          </button>

          <button
            onClick={() => handleThemeChange("SYSTEM")}
            className={`p-4 border-2 rounded-lg transition ${
              profile?.theme === "SYSTEM"
                ? "border-border bg-muted"
                : "border-border hover:border-border"
            }`}
          >
            <div className="text-center">
              <div className="text-3xl mb-2">💻</div>
              <div className="font-medium">跟随系统</div>
            </div>
          </button>
        </div>
      </section>

      {/* 账户信息 */}
      <section className="bg-muted rounded-lg p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">账户信息</h2>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">账户 ID</p>
            <p className="font-mono mt-1">{profile?.id.slice(0, 8)}...</p>
          </div>

          <div>
            <p className="text-muted-foreground">注册时间</p>
            <p className="mt-1">
              {profile?.created_at &&
                new Date(profile.created_at).toLocaleDateString("zh-CN")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
