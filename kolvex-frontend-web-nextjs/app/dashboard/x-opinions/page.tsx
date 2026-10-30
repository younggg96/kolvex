import { Suspense } from "react";
import XContentExplorer from "@/components/x/XContentExplorer";

export default function XOpinionsPage() {
  return (
    <Suspense>
      <XContentExplorer />
    </Suspense>
  );
}
