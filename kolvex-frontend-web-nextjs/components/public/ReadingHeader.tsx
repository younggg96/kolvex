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
    <header className="reading-header relative z-10 border-b border-border/70 bg-sidebar">
      <div className="mx-auto flex min-h-16 max-w-[1120px] items-center justify-between gap-4 px-4 py-2.5 md:px-8">
        <Link href="/" className="inline-flex shrink-0 items-center gap-2 rounded-sm text-xl font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><LogoIcon size={26} />Kolvex</Link>
        <div className="flex items-center gap-2">
          <ThemeToggle labels={{ light: "切换到浅色模式", dark: "切换到深色模式" }} />
          <Button asChild variant="outline" size="sm"><Link href="/auth">打开工作台</Link></Button>
        </div>
      </div>
      <nav aria-label="公开阅读" className="mx-auto flex max-w-[1120px] gap-6 px-4 md:px-8">
        {links.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`) || (href === "/creators" && pathname.startsWith("/share/creators/"));
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("reading-nav-link inline-flex min-h-11 items-center border-b-2 px-1 text-sm font-semibold transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary", active ? "text-foreground" : "text-muted-foreground")}>{label}</Link>;
        })}
      </nav>
    </header>
  );
}
