import type { Metadata } from "next";
import { Suspense } from "react";
import {
  PersonUpdatesLoading,
  PersonUpdatesReader,
  PersonUpdatesTitle,
} from "@/components/person-updates/PersonUpdatesReader";

export const metadata: Metadata = {
  title: "人物动态 | Kolvex",
};

export default function TrackerPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PersonUpdatesTitle />
      <Suspense fallback={<PersonUpdatesLoading />}>
        <PersonUpdatesReader />
      </Suspense>
    </div>
  );
}
