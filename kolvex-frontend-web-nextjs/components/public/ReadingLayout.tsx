import Link from "next/link";
import LogoIcon from "@/components/common/LogoIcon";
import { Button } from "@/components/ui/button";

export function ReadingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="zh-CN" className="min-h-dvh bg-background text-foreground">
      <a href="#public-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4">跳到正文</a>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-4 py-5 md:px-8">
          <Link href="/" className="inline-flex items-center gap-2 rounded-sm text-xl font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><LogoIcon size={26} />Kolvex</Link>
          <Button asChild variant="outline" size="sm"><Link href="/auth">打开工作台</Link></Button>
          <nav aria-label="公开阅读" className="flex w-full flex-wrap gap-6 text-sm font-medium">
            <Link href="/research" className="py-2 underline-offset-8 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">股票研究</Link>
            <Link href="/creators" className="py-2 underline-offset-8 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">博主观点</Link>
            <Link href="/stocks" className="py-2 underline-offset-8 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">股票目录</Link>
          </nav>
        </div>
      </header>
      <main id="public-content" className="mx-auto w-full max-w-[1120px] px-4 py-8 md:px-8 md:py-12">{children}</main>
      <footer className="mx-auto max-w-[1120px] space-y-4 border-t border-border px-4 py-8 text-sm text-muted-foreground md:px-8">
        <p>研究和观点保留其原始日期与来源，阅读时请结合当时的市场背景。</p>
        <nav aria-label="网站信息" className="flex flex-wrap gap-6"><Link href="/" className="hover:underline">首页</Link><Link href="/contact" className="hover:underline">联系 Kolvex</Link><Link href="/privacy" className="hover:underline">隐私政策</Link><Link href="/terms" className="hover:underline">服务条款</Link></nav>
      </footer>
    </div>
  );
}
