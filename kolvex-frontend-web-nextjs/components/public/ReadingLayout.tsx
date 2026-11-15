import Link from "next/link";
import { Suspense } from "react";
import { ReadingHeader } from "./ReadingHeader";
import { ReadingMotion } from "./ReadingMotion";

/**
 * Reading motion, scoped to anonymous reading pages (shared workspace cards stay unchanged).
 * ReadingMotion toggles `data-reading-pending`; rows and cards opt in with `data-reading-item`.
 * Every class is spelled out in full so Tailwind's scanner can find it.
 */
const readingMotionClass = [
  // Reveal and tap feedback.
  "[&_[data-reading-pending]]:opacity-0",
  "[&_:is(a,button)]:[-webkit-tap-highlight-color:transparent]",
  "[&_[data-reading-item]>a]:[transition:transform_500ms_var(--ease-out-quint),background-color_300ms_var(--ease-out-quint),border-color_300ms_var(--ease-out-quint)]",
  "[&_[data-reading-item]>a:active]:scale-[.99]",
  "[&_[data-reading-item]>a:focus-visible]:outline [&_[data-reading-item]>a:focus-visible]:outline-2 [&_[data-reading-item]>a:focus-visible]:outline-offset-4 [&_[data-reading-item]>a:focus-visible]:outline-positive",
  "[&_[data-reading-item=row]>a>svg:last-child]:[transition:transform_500ms_var(--ease-out-quint),color_300ms_var(--ease-out-quint)]",
  "[&_[data-reading-item=card]>a>div:first-child>:first-child]:[transition:transform_500ms_var(--ease-out-quint)]",
  "[&_.reading-header_:is(a,button)]:[transition:transform_500ms_var(--ease-out-quint),background-color_300ms_var(--ease-out-quint),color_300ms_var(--ease-out-quint)]",
  "[&_.reading-pagination_a]:[transition:transform_500ms_var(--ease-out-quint),background-color_300ms_var(--ease-out-quint),color_300ms_var(--ease-out-quint)]",
  "[&_.reading-header_:is(a,button):active]:scale-[.97] [&_.reading-pagination_a:active]:scale-[.97]",
  // Pointer hover only: cards lift and their art grows, rows and their arrow slide.
  "[@media(hover:hover)_and_(pointer:fine)]:[&_[data-reading-item=card]>a:hover]:-translate-y-1",
  "[@media(hover:hover)_and_(pointer:fine)]:[&_[data-reading-item=card]>a:hover>div:first-child>:first-child]:scale-[1.06]",
  "[@media(hover:hover)_and_(pointer:fine)]:[&_[data-reading-item=row]>a:hover]:translate-x-1",
  "[@media(hover:hover)_and_(pointer:fine)]:[&_[data-reading-item=row]>a:hover>svg:last-child]:translate-x-1 [@media(hover:hover)_and_(pointer:fine)]:[&_[data-reading-item=row]>a:hover>svg:last-child]:text-positive",
  // Reduced motion and print show everything at rest.
  "motion-reduce:[&_[data-reading-pending]]:!opacity-100 print:[&_[data-reading-pending]]:!opacity-100",
  "motion-reduce:[&_*]:![animation:none] motion-reduce:[&_*]:![transition:none] motion-reduce:[&_*]:![scroll-behavior:auto]",
  "motion-reduce:[&_*::before]:![animation:none] motion-reduce:[&_*::before]:![transition:none] motion-reduce:[&_*::after]:![animation:none] motion-reduce:[&_*::after]:![transition:none]",
  "motion-reduce:[&_[data-reading-item]>a]:!transform-none motion-reduce:[&_[data-reading-item]>a>div:first-child>:first-child]:!transform-none motion-reduce:[&_[data-reading-item=row]>a>svg:last-child]:!transform-none motion-reduce:[&_.reading-header_:is(a,button)]:!transform-none motion-reduce:[&_.reading-pagination_a]:!transform-none",
].join(" ");

export function ReadingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="zh-CN" className={`site-page-surface reading-shell min-h-dvh bg-background text-foreground ${readingMotionClass}`}>
      <a href="#public-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4">跳到正文</a>
      <ReadingHeader />
      <main id="public-content" className="mx-auto w-full max-w-[70rem] px-[16px] pb-10 pt-6 md:px-8 md:pt-8">{children}</main>
      <Suspense fallback={null}><ReadingMotion /></Suspense>
      <footer className="mx-auto max-w-[70rem] space-y-4 border-t border-border px-[16px] py-8 text-xs text-muted-foreground md:px-8">
        <p>研究和观点保留其原始日期与来源，阅读时请结合当时的市场背景。</p>
        <nav aria-label="网站信息" className="flex flex-wrap items-center gap-x-6">
          <Link href="/" className="py-2 hover:underline">首页</Link>
          <Link href="/contact" className="py-2 hover:underline">联系 Kolvex</Link>
          <Link href="/privacy" className="py-2 hover:underline">隐私政策</Link>
          <Link href="/terms" className="py-2 hover:underline">服务条款</Link>
          <a href="https://github.com/younggg96/kolvex" className="py-2 hover:underline">在 GitHub 加星</a>
        </nav>
      </footer>
    </div>
  );
}
