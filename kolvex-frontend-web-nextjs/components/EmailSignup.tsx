"use client";

import { useState, FormEvent, useEffect } from "react";
import { toast } from "sonner";

// Country options with language mapping
const countries = [
  { code: "US", flag: "🇺🇸", language: "en" },
  { code: "CN", flag: "🇨🇳", language: "zh" },
  { code: "JP", flag: "🇯🇵", language: "ja" },
  { code: "KR", flag: "🇰🇷", language: "ko" },
  { code: "GB", flag: "🇬🇧", language: "en" },
  { code: "CA", flag: "🇨🇦", language: "en" },
  { code: "AU", flag: "🇦🇺", language: "en" },
  { code: "DE", flag: "🇩🇪", language: "de" },
  { code: "FR", flag: "🇫🇷", language: "fr" },
  { code: "ES", flag: "🇪🇸", language: "es" },
  { code: "IT", flag: "🇮🇹", language: "it" },
  { code: "BR", flag: "🇧🇷", language: "pt" },
  { code: "MX", flag: "🇲🇽", language: "es" },
  { code: "IN", flag: "🇮🇳", language: "en" },
  { code: "SG", flag: "🇸🇬", language: "en" },
  { code: "HK", flag: "🇭🇰", language: "zh" },
  { code: "TW", flag: "🇹🇼", language: "zh" },
];

export default function EmailSignup() {
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("US");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detect system country/region on mount
  useEffect(() => {
    const locale = navigator.language; // e.g., "en-US", "zh-CN"
    const countryCode = locale.split("-")[1]?.toUpperCase();

    // Check if detected country is in our list
    const supportedCountryCodes = countries.map((c) => c.code);
    if (countryCode && supportedCountryCodes.includes(countryCode)) {
      setCountry(countryCode);
    }
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Invalid email format");
      return;
    }

    // Get language from selected country
    const selectedCountry = countries.find((c) => c.code === country);
    const language = selectedCountry?.language || "en";

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          language,
          isActive: "true",
        }),
      });

      if (response.ok) {
        toast.success("Success! You will receive our stock daily digest.");
        setEmail("");
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(`Failed: ${errorData.message || "Please try again later"}`);
      }
    } catch (error) {
      console.error("Signup error:", error);
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-sm sm:max-w-lg px-4 sm:px-0">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
        {/* Mobile: Separate input and button */}
        <div className="flex flex-col gap-3 sm:hidden">
          <div className="glow-border rounded-full">
            <input
              type="email"
              className="w-full h-12 rounded-full text-gray-900 dark:text-white bg-gray-200/80 dark:bg-white/5 backdrop-blur-sm border-0 focus:ring-0 placeholder:text-gray-500 dark:placeholder:text-white/40 px-5 text-sm font-normal focus:outline-none"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 rounded-full bg-primary text-white dark:text-background-dark text-sm font-bold tracking-wide hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Submitting..." : "Get Early Access"}
          </button>
        </div>

        {/* Tablet & Desktop: Combined input and button */}
        <div className="hidden sm:block glow-border rounded-full">
          <div className="flex w-full items-stretch rounded-full h-12 md:h-14 bg-gray-200/80 dark:bg-white/5 backdrop-blur-sm">
            <input
              type="email"
              className="flex-1 min-w-0 resize-none overflow-hidden rounded-l-full text-gray-900 dark:text-white bg-transparent border-0 focus:ring-0 placeholder:text-gray-500 dark:placeholder:text-white/40 px-5 md:px-6 text-sm md:text-base font-normal focus:outline-none"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex min-w-[140px] md:min-w-[150px] items-center justify-center rounded-r-full px-5 md:px-6 bg-primary text-white dark:text-background-dark text-sm md:text-base font-bold tracking-wide hover:bg-primary/90 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Submitting..." : "Get Early Access"}
            </button>
          </div>
        </div>

        {/* Language Selector - Below email input */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-white/50">
          <span>Change your notification language:</span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="appearance-none bg-gray-200 dark:bg-white/5 rounded-full backdrop-blur-sm border border-gray-300 dark:border-white/10 px-2 py-1 text-gray-800 dark:text-white/80 text-xs cursor-pointer focus:outline-none focus:border-primary/50 hover:border-primary/30 transition-colors"
          >
            {countries.map((c) => (
              <option
                key={c.code}
                value={c.code}
                className="bg-white dark:bg-background-dark"
              >
                {c.flag} {c.code}
              </option>
            ))}
          </select>
        </div>
      </form>
    </div>
  );
}
