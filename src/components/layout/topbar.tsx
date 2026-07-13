"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Search, Bell, ChevronDown, LogOut, Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";

export interface TopBarProps {
  name: string;
  initials: string;
  role: string;
}

export function TopBar({ name, initials, role }: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Chiudi il drawer al cambio di rotta (i link della Sidebar navigano).
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Esc chiude il drawer; blocca lo scroll del body mentre è aperto.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 items-center gap-2 border-b border-line bg-surface px-4 sm:gap-4 sm:px-6">
      <button
        type="button"
        onClick={() => setNavOpen(true)}
        aria-label="Apri menu di navigazione"
        aria-expanded={navOpen}
        className="grid size-10 shrink-0 place-items-center rounded text-ink-muted transition-colors hover:bg-surface-sunken md:hidden"
      >
        <Menu className="size-5" />
      </button>

      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
          aria-hidden
        />
        <input
          type="search"
          aria-label="Cerca"
          placeholder="Cerca prodotti, kit, codici…"
          className="h-10 w-full rounded bg-surface-sunken pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
        />
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <button
          type="button"
          aria-label="Notifiche"
          className="hidden size-10 place-items-center rounded text-ink-muted transition-colors hover:bg-surface-sunken sm:grid"
        >
          <Bell className="size-5" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded p-1 pr-2 transition-colors hover:bg-surface-sunken"
          >
            <span className="grid size-8 place-items-center rounded-full bg-brand text-xs font-semibold text-white">
              {initials}
            </span>
            <span className="hidden text-sm font-medium text-ink sm:block">{name}</span>
            <ChevronDown className="size-4 text-ink-subtle" aria-hidden />
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-line bg-surface p-1 shadow-pop"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-sunken"
                >
                  <LogOut className="size-4" aria-hidden /> Esci
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Drawer di navigazione mobile (< md). La sidebar desktop resta in layout.tsx. */}
      {navOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigazione">
          <button
            type="button"
            aria-label="Chiudi menu"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 animate-fade-in bg-ink/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-[264px] max-w-[82%] animate-drawer-in flex-col shadow-modal">
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              aria-label="Chiudi menu"
              className="absolute right-2 top-4 z-10 grid size-9 place-items-center rounded text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" />
            </button>
            <Sidebar role={role} />
          </div>
        </div>
      )}
    </header>
  );
}
