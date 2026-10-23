import Market from "@/components/decision/Market";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  return <Suspense fallback={<div className="p-8"><Skeleton className="h-96 w-full" /></div>}><Market /></Suspense>;
}
