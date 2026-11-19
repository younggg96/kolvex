import type { Metadata } from "next";
import { Suspense } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  PersonUpdatesLoading,
  PersonUpdatesReader,
  PersonUpdatesTitle,
} from "@/components/person-updates/PersonUpdatesReader";

export const metadata: Metadata = {
  title: "动态 | Kolvex",
};

export default function PersonUpdatesPage() {
  return (
    <DashboardLayout>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-8 pt-6 md:px-8 md:pt-8">
          <PersonUpdatesTitle />
          <Suspense fallback={<PersonUpdatesLoading />}>
            <PersonUpdatesReader />
          </Suspense>
        </div>
      </div>
    </DashboardLayout>
  );
}
