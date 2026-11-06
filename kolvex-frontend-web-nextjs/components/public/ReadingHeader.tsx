"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoIcon from "@/components/common/LogoIcon";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "/research", label: "股票研究" },
  { href: "/creators", label: "博主观点" },
  { href: "/stocks", label: "股票目录" },
];

export function ReadingHeader() {
  const pathname = usePathname();
  return (
    <header className="reading-header glass-header sticky top-0 z-40 border-b">
      <div className="mx-auto flex min-h-16 max-w-[70rem] items-center justify-between gap-4 px-[16px] py-2.5 md:px-8">
        <Link href="/" className="inline-flex shrink-0 items-center gap-2 rounded-sm text-xl font-extrabold focus-visible:outline-none "><LogoIcon size={26} />Kolvex</Link>
        <div className="flex items-center gap-2">
          <ThemeToggle labels={{ light: "切换到浅色模式", dark: "切换到深色模式" }} />
          <Button asChild variant="outline" size="sm"><Link href="/auth">打开工作台</Link></Button>
        </div>
      </div>
      <nav aria-label="公开阅读" className="mx-auto flex max-w-[70rem] gap-2 px-[16px] pb-3 md:px-8">
        {links.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`) || (href === "/creators" && pathname.startsWith("/share/creators/"));
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("reading-nav-link inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none ", active ? "glass-thumb text-foreground" :"text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.1]")}>{label}</Link>;
        })}
      </nav>
    </header>
  );
}
