"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Search, Bell, ChevronDown, LogOut } from "lucide-react";

export interface TopBarProps {
  name: string;
  initials: string;
}

export function TopBar({ name, initials }: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-line bg-surface px-4 sm:px-6">
      <div className="relative w-full max-w-md">
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

      <div className="flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          aria-label="Notifiche"
          className="grid size-10 place-items-center rounded text-ink-muted transition-colors hover:bg-surface-sunken"
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
    </header>
  );
}
