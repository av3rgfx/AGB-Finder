"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function NavItem({ href, label, icon: Icon, badge }: NavItemProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded px-3.5 text-sm font-medium transition-colors duration-150",
        active
          ? "bg-brand/[0.12] text-brand"
          : "text-white/60 hover:bg-white/[0.04] hover:text-surface-page",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{label}</span>
      {badge ? (
        <span className="rounded-full bg-brand px-1.5 text-xs font-semibold text-white">{badge}</span>
      ) : null}
    </Link>
  );
}
