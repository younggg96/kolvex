"use client";

import DashboardLayout from "@/components/DashboardLayout";
import SectionCard from "@/components/SectionCard";
import FinancialJuiceNews from "@/components/FinancialJuiceNews";

interface NewsPageClientProps {
  category: string;
}

export default function NewsPageClient({ category }: NewsPageClientProps) {
  return (
    <DashboardLayout title="Market News">
      <div className="flex-1 p-2 overflow-y-auto">
        {/* Main News Content */}
        <div className="space-y-2">
          {/* News Content with SectionCard */}
          <SectionCard
            useSectionHeader={false}
            padding="md"
            scrollable
            contentClassName="space-y-0 px-4 pb-4 mt-2"
          >
            {/* Market News - FinancialJuice News */}
            <div className="h-[calc(100vh-160px)]">
              <FinancialJuiceNews width="100%" height="100%" />
            </div>
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
