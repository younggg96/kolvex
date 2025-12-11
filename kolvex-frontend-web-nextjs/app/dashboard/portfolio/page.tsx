"use client";

import { Suspense } from "react";
import { PortfolioPageContent } from "@/components/portfolio";

function PortfolioPage() {
  return (
    <Suspense fallback={null}>
      <PortfolioPageContent />
    </Suspense>
  );
}

export default PortfolioPage;
