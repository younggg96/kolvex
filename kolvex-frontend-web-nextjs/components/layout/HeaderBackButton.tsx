"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type HeaderBackButtonProps = {
  label: string;
} & (
  | { href: string; onClick?: never }
  | { href?: never; onClick: () => void }
);

export default function HeaderBackButton({ label, href, onClick }: HeaderBackButtonProps) {
  const icon = <ArrowLeft className="h-4 w-4" aria-hidden="true" />;

  return href !== undefined ? (
    <Button asChild variant="ghost" size="icon" className="shrink-0" title={label} aria-label={label}>
      <Link href={href}>{icon}</Link>
    </Button>
  ) : (
    <Button type="button" variant="ghost" size="icon" className="shrink-0" title={label} aria-label={label} onClick={onClick}>
      {icon}
    </Button>
  );
}
