"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";
import { paperSetupHref } from "@/lib/paperTrading";
import type { AiTechnicalAnalysis } from "@/lib/stockApi";

export default function SetupTradeLink({
  symbol,
  setup,
}: {
  symbol: string;
  setup: NonNullable<AiTechnicalAnalysis["setup"]>;
}) {
  const c = useCopy();
  return (
    <Button asChild variant="outline" className="mt-4">
      <Link href={paperSetupHref(symbol, setup)}>
        {c("Practice this setup", "用此计划模拟交易")}
      </Link>
    </Button>
  );
}
