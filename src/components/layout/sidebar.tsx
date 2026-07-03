"use client";

import { LayoutDashboard, MessageSquare, Package, ClipboardList, Settings } from "lucide-react";
import { NavItem, type NavItemProps } from "./nav-item";

const PRIMARY_NAV: NavItemProps[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assistente", label: "Assistente", icon: MessageSquare },
  { href: "/archivio", label: "Archivio", icon: Package },
  { href: "/richieste", label: "Richieste Kit", icon: ClipboardList },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-full flex-col bg-surface-sidebar">
      <div className="flex h-16 items-center px-5">
        <span className="text-lg font-bold tracking-tight text-white">
          UFP<span className="font-normal text-white/60">trade</span>
        </span>
      </div>

      <nav aria-label="Navigazione principale" className="flex flex-1 flex-col gap-1 px-3 py-2">
        {PRIMARY_NAV.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      <div className="border-t border-white/[0.06] px-3 py-3">
        <NavItem href="/impostazioni" label="Impostazioni" icon={Settings} />
      </div>
    </aside>
  );
}
