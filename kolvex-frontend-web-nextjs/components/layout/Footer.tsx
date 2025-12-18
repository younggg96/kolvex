"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import LogoIcon from "@/components/common/LogoIcon";
import { Twitter, Github, Linkedin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default function Footer() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const linkClass =
    "text-foreground/60 hover:text-primary transition-all flex items-center gap-1 group/link text-sm";

  return (
    <footer className="relative z-10 w-full bg-background-light dark:bg-background-dark pt-20 pb-10 px-4 sm:px-6 md:px-8">
      {/* Background Decorative Glow */}
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-16">
          {/* Brand Column */}
          <div className="space-y-6">
            <Link
              href="/"
              className="flex items-center gap-2 group transition-all w-fit"
            >
              <LogoIcon
                size={32}
                className="group-hover:scale-110 transition-transform"
              />
              <span className="text-2xl font-black text-foreground tracking-tighter">
                Kolvex
              </span>
            </Link>
            <p className="text-foreground/60 text-sm leading-relaxed max-w-xs">
              Empowering global investors with real-time social intelligence and
              AI-driven market sentiment analysis. Stay ahead of the curve.
            </p>
            <div className="flex items-center gap-3">
              {[
                { icon: Twitter, href: "#" },
                { icon: Github, href: "#" },
                { icon: Linkedin, href: "#" },
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  className="p-2.5 rounded-xl bg-primary/5 border border-primary/10 text-foreground/50 hover:text-primary hover:border-primary/30 hover:bg-primary/10 transition-all"
                >
                  <social.icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Resources Column */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <h4 className="text-foreground font-bold text-sm tracking-tight uppercase">
                Resources
              </h4>
            </div>
            <ul className="space-y-4">
              <li>
                <Link href="/contact" className={linkClass}>
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/terms" className={linkClass}>
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={linkClass}>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/contact" className={linkClass}>
                  Contact Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter Column */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <h4 className="text-foreground font-bold text-sm tracking-tight uppercase">
                Newsletter
              </h4>
            </div>
            <p className="text-sm text-foreground/60">
              Get the latest social intelligence and market trends in your
              inbox.
            </p>
            <form className="flex gap-2 group">
              <Input
                type="email"
                placeholder="Email address"
                className="bg-primary/5 border-primary/10 rounded-xl focus-visible:ring-primary/20 h-11"
              />
              <Button
                size="icon"
                className="rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 h-11 w-11 flex-shrink-0"
              >
                <Send size={16} />
              </Button>
            </form>
          </div>
        </div>

        <Separator className="bg-primary/10" />

        {/* Bottom Section */}
        <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-[10px] font-mono uppercase tracking-widest text-foreground/40 font-medium">
            © 2025 Kolvex AI Intelligence. All rights reserved.
          </p>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-foreground/40 font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Systems Operational
            </div>
            <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest text-foreground/40">
              <span className="hover:text-primary cursor-pointer transition-colors">
                API Status
              </span>
              <span className="hover:text-primary cursor-pointer transition-colors">
                Documentation
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
