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
      <div className="relative z-10 flex flex-1 items-start justify-center px-4 py-12 md:py-16">
        <div className="w-full max-w-[420px]">
          <div className="flex flex-col gap-7">
            <div className="flex flex-col gap-3 text-left">
              <h1 className="rh-enter text-3xl font-medium text-foreground">
                {title}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </BaseLayout>
  );
}
