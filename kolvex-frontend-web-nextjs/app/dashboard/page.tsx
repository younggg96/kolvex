import Market from "@/components/decision/Market";
import { Suspense } from "react";
import { ContentLoading } from "@/components/ui/content-loading";

export default function Dashboard() {
  return <Suspense fallback={<ContentLoading variant="page" className="min-h-[50dvh] w-full px-[16px] md:px-8" />}><Market /></Suspense>;
}
