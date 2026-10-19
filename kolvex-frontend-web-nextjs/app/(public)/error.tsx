"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PublicReadingError() {
  return <div className="min-h-[40vh] max-w-lg space-y-5 py-12" role="alert">
    <h1 className="text-2xl font-semibold">暂时无法加载内容</h1>
    <p className="leading-7 text-muted-foreground">请稍后重试，或返回目录选择其他内容。</p>
    <Button onClick={() => window.location.reload()}>重试</Button>
    <p><Link href="/research" className="text-sm underline underline-offset-4">返回股票研究</Link></p>
  </div>;
}
