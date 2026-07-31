"use client";

import {
  Building2,
  LayoutDashboard,
  MessageSquare,
  Package,
  ClipboardList,
  Settings,
  Users,
} from "lucide-react";
import { NavItem, type NavItemProps } from "./nav-item";

const PRIMARY_NAV: NavItemProps[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assistente", label: "Assistente", icon: MessageSquare },
  { href: "/archivio", label: "Archivio", icon: Package },
  { href: "/richieste", label: "Richieste Kit", icon: ClipboardList },
  // Fuori dal blocco ADMIN: l'anagrafica è condivisa e il router usa
  // `agentProcedure`. Fino al 2026-07-30 `customer.update`/`delete` esistevano
  // senza una schermata da cui raggiungerli.
  { href: "/clienti", label: "Clienti", icon: Building2 },
];

export function Sidebar({ role }: { role: string }) {
  const isAdmin = role === "ADMIN";
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

      {isAdmin && (
        <div className="border-t border-white/[0.06] px-3 py-3">
          <NavItem href="/utenti" label="Utenti" icon={Users} />
          <NavItem href="/impostazioni" label="Impostazioni" icon={Settings} />
        </div>
      )}
    </aside>
  );
}
