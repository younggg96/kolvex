import type { Metadata } from "next";
import { Suspense } from "react";
import { ReadingText } from "@/components/public/ReadingElements";
import {
  PersonUpdatesLoading,
  PersonUpdatesReader,
} from "@/components/person-updates/PersonUpdatesReader";

export const metadata: Metadata = {
  title: "关键人物动态 | Kolvex",
};

export default function TrackerPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        <ReadingText en="Key Person Updates" zh="关键人物动态" />
      </h1>
      <Suspense fallback={<PersonUpdatesLoading />}>
        <PersonUpdatesReader />
      </Suspense>
    </div>
  );
}
