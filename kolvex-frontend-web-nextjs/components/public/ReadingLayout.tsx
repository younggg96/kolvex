import Link from "next/link";
import { Suspense } from "react";
import { ReadingHeader } from "./ReadingHeader";
import { ReadingMotion } from "./ReadingMotion";
import "./reading-motion.css";

export function ReadingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="zh-CN" className="reading-shell min-h-dvh bg-background text-foreground">
      <a href="#public-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4">跳到正文</a>
      <ReadingHeader />
      <main id="public-content" className="mx-auto w-full max-w-[1120px] px-4 pb-16 pt-6 md:px-8 md:pt-8">{children}</main>
      <Suspense fallback={null}><ReadingMotion /></Suspense>
      <footer className="mx-auto max-w-[1120px] space-y-4 border-t border-border px-4 py-8 text-xs text-muted-foreground md:px-8">
        <p>研究和观点保留其原始日期与来源，阅读时请结合当时的市场背景。</p>
        <nav aria-label="网站信息" className="flex flex-wrap gap-6"><Link href="/" className="hover:underline">首页</Link><Link href="/contact" className="hover:underline">联系 Kolvex</Link><Link href="/privacy" className="hover:underline">隐私政策</Link><Link href="/terms" className="hover:underline">服务条款</Link></nav>
      </footer>
    </div>
  );
}
