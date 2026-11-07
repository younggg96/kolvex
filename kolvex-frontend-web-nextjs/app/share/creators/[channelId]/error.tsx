"use client";

import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";

export default function SharePageError({ reset }: { reset: () => void }) {
  const c = useCopy();
  return <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-5 px-6 text-center">
    <h1 className="text-2xl font-semibold">{c("Opinions could not be loaded", "暂时无法加载观点")}</h1>
    <Button onClick={reset}>{c("Retry", "重试")}</Button>
  </main>;
}
