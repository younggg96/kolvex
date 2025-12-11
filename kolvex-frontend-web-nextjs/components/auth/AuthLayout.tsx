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
    <BaseLayout>
      <div className="relative z-10 flex-1 flex items-start justify-center text-center px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16">
        <div className="w-full max-w-sm sm:max-w-md">
          <div className="flex flex-col gap-6 sm:gap-8 items-center justify-center">
            <div className="flex flex-col gap-2 sm:gap-3 animate-fade-in-up">
              <h1 className="text-gray-900 dark:text-white text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter">
                {title}
              </h1>
              <h2 className="text-gray-700 dark:text-white/70 text-sm sm:text-base font-normal px-4">
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
