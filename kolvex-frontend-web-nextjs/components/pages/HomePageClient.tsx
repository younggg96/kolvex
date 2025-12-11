"use client";

import EmailSignup from "@/components/user/EmailSignup";
import TypewriterText from "@/components/common/TypewriterText";
import BaseLayout from "@/components/layout/BaseLayout";

export default function HomePageClient() {
  return (
    <BaseLayout>
      <div className="relative z-10 flex-1 flex items-center justify-center text-center px-4 sm:px-6 md:px-8">
        <div className="w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-2xl">
          <div className="flex flex-col gap-8 sm:gap-12 items-center justify-center">
            <div className="flex flex-col gap-1 sm:gap-2">
              <h1 className="text-gray-900 dark:text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter min-h-[80px] sm:min-h-[100px] md:min-h-[120px] flex items-center justify-center px-2">
                <TypewriterText
                  phrases={[
                    "Welcome to Kolvex AI",
                    "Track Social Media KOLs",
                    "AI-Powered Investment Analysis",
                    "Monitor Retail Sentiment",
                    "Follow the Smart Money",
                    "AI-Ranked Stock Ideas",
                    "Multi-Platform Intelligence",
                  ]}
                  typingSpeed={80}
                  deletingSpeed={40}
                  delayBetweenPhrases={2500}
                />
              </h1>
              <h2 className="text-gray-700 dark:text-white/70 text-sm sm:text-base md:text-lg font-normal px-4">
                Sign up for early access or updates.
              </h2>
            </div>
            <EmailSignup />
          </div>
        </div>
      </div>
    </BaseLayout>
  );
}
