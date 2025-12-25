import { ReactNode } from "react";
import BaseLayout from "@/components/layout/BaseLayout";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export default function AuthLayout({
  children,
  title,
  subtitle,
}: AuthLayoutProps) {
  return (
    <BaseLayout hasFooter={false}>
      <div className="relative z-10 flex-1 flex items-start justify-center text-center px-4 sm:px-6 md:px-8 py-8 sm:py-10 md:py-12">
        <div className="w-full max-w-sm sm:max-w-md">
          <div className="flex flex-col gap-4 sm:gap-6 items-center justify-center">
            <div className="flex flex-col gap-1.5 sm:gap-2 animate-fade-in-up">
              <h1 className="text-gray-900 dark:text-white text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter">
                {title}
              </h1>
              <h2 className="text-gray-700 dark:text-white/70 text-xs sm:text-sm font-normal px-4">
                {subtitle}
              </h2>
            </div>
            {children}
          </div>
        </div>
      </div>
    </BaseLayout>
  );
}
