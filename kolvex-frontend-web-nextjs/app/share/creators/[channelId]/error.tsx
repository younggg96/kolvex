"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";

export default function SharePageError({ reset }: { reset: () => void }) {
  const c = useCopy();
  return <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-5 px-6 text-center">
    <h1 className="text-2xl font-semibold">{c("Opinions could not be loaded", "暂时无法加载观点")}</h1>
    <p className="text-sm text-muted-foreground">{c("Please retry in a moment.", "请稍后重试。")}</p>
    <Button onClick={reset}>{c("Retry", "重试")}</Button>
    <Link href="/" className="text-sm text-positive underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{c("Kolvex home", "返回 Kolvex 首页")}</Link>
  </main>;
}
