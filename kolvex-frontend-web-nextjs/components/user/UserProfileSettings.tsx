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
    updateNotifications,
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

  // 更新通知设置
  const handleNotificationToggle = async () => {
    if (!profile) return;

    const result = await updateNotifications({
      email_notifications_enabled: !profile.email_notifications_enabled,
    });

    if (result.success) {
      setMessage({
        type: "success",
        text: profile.email_notifications_enabled ? "已关闭邮件通知" : "已开启邮件通知",
      });
    } else {
      setMessage({ type: "error", text: result.error || "更新失败" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold">加载失败</h3>
          <p className="text-red-600 mt-2">{error}</p>
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
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              邮箱
            </label>
            <input
              type="email"
              value={profile?.email || ""}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
            />
            <p className="text-sm text-gray-500 mt-1">邮箱无法修改</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              用户名
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="输入用户名"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              全名
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              placeholder="输入全名"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              手机号
            </label>
            <input
              type="tel"
              name="phone_e164"
              value={formData.phone_e164}
              onChange={handleInputChange}
              placeholder="+1234567890"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-1">
              请使用 E.164 格式（如 +1234567890）
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
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
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
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
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
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
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="text-center">
              <div className="text-3xl mb-2">💻</div>
              <div className="font-medium">跟随系统</div>
            </div>
          </button>
        </div>
      </section>

      {/* 通知设置 */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">通知设置</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">邮件通知</p>
              <p className="text-sm text-gray-600">
                开启后当关注的人有持仓变化时会收到邮件通知
              </p>
            </div>

            <button
              onClick={handleNotificationToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                profile?.email_notifications_enabled ? "bg-blue-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  profile?.email_notifications_enabled
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 账户信息 */}
      <section className="bg-gray-50 rounded-lg p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">账户信息</h2>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">账户 ID</p>
            <p className="font-mono mt-1">{profile?.id.slice(0, 8)}...</p>
          </div>

          <div>
            <p className="text-gray-600">注册时间</p>
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
