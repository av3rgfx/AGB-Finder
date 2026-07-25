"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, Check, MoreVertical, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { groupConversations } from "@/lib/chat/group-conversations";

export interface ConversationListItem {
  id: string;
  title: string;
  updatedAt: Date;
}

export interface ConversationsPanelProps {
  items: ConversationListItem[];
  activeId: string | null;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}

/**
 * Contenuto della lista conversazioni, usato sia come rail desktop sia dentro il drawer
 * mobile (la chrome del drawer è del prossimo task — questo componente resta puramente
 * presentazionale e non assume una larghezza fissa, `w-full h-full`).
 * Filtro di ricerca applicato localmente su `items` (titolo, case-insensitive):
 * `onSearch` informa comunque il chiamante del valore digitato (es. per sincronizzarlo
 * nell'URL), ma il componente non dipende da un giro di rete per filtrare dal vivo.
 */
export function ConversationsPanel({
  items,
  activeId,
  search,
  onSearch,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onArchive,
}: ConversationsPanelProps) {
  const query = search.trim().toLowerCase();
  const filtered = query ? items.filter((c) => c.title.toLowerCase().includes(query)) : items;
  const groups = groupConversations(filtered, new Date());

  return (
    <div className="flex h-full min-w-0 flex-col gap-3">
      <button
        type="button"
        onClick={onNew}
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-white transition-colors duration-150 ease-out-quart hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <Plus className="size-4" aria-hidden />
        Nuova conversazione
      </button>

      <div className="relative shrink-0">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Cerca conversazioni…"
          aria-label="Cerca conversazioni"
          className="h-10 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <p className="px-1 py-4 text-center text-sm text-ink-subtle">
            {query ? "Nessuna conversazione trovata." : "Nessuna conversazione."}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-3">
              <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                {group.label}
              </h3>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    active={conversation.id === activeId}
                    onSelect={() => onSelect(conversation.id)}
                    onRename={(title) => onRename(conversation.id, title)}
                    onArchive={() => onArchive(conversation.id)}
                    onDelete={() => onDelete(conversation.id)}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
  onSelect,
  onRename,
  onArchive,
  onDelete,
}: {
  conversation: ConversationListItem;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "renaming" | "deleting">("idle");
  const [draft, setDraft] = useState(conversation.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "renaming") inputRef.current?.focus();
  }, [mode]);

  // Stesso pattern del dropdown ⋯ di `utenti-client.tsx`: `position: fixed` posizionato dal
  // rect del bottone (la lista è in `overflow-y-auto`, che ritaglierebbe un dropdown `absolute`),
  // chiuso su scroll/resize/Esc/click sul backdrop.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function openMenu() {
    const r = menuBtnRef.current?.getBoundingClientRect();
    if (r) setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setMenuOpen(true);
  }

  function commitRename() {
    const title = draft.trim();
    if (title && title !== conversation.title) onRename(title);
    setMode("idle");
  }

  function cancelRename() {
    setDraft(conversation.title);
    setMode("idle");
  }

  if (mode === "renaming") {
    return (
      <li>
        <form
          className="flex items-center gap-1 px-1 py-0.5"
          onSubmit={(e) => {
            e.preventDefault();
            commitRename();
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                cancelRename();
              }
            }}
            aria-label="Rinomina conversazione"
            className="h-10 min-w-0 flex-1 rounded border border-brand bg-surface px-2 text-sm text-ink focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Conferma rinomina"
            className="grid size-10 shrink-0 place-items-center rounded text-success transition-colors duration-150 ease-out-quart hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <Check className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Annulla rinomina"
            onClick={cancelRename}
            className="grid size-10 shrink-0 place-items-center rounded text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <X className="size-4" aria-hidden />
          </button>
        </form>
      </li>
    );
  }

  if (mode === "deleting") {
    return (
      <li className="flex items-center gap-2 rounded-md bg-danger/5 px-2 py-1">
        <span className="min-w-0 flex-1 truncate text-sm text-ink">
          Eliminare «{conversation.title}»?
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex min-h-10 shrink-0 items-center rounded px-2.5 text-xs font-medium text-danger transition-colors duration-150 ease-out-quart hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          Elimina
        </button>
        <button
          type="button"
          onClick={() => setMode("idle")}
          className="inline-flex min-h-10 shrink-0 items-center rounded px-2.5 text-xs font-medium text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          Annulla
        </button>
      </li>
    );
  }

  return (
    <li className={cn("group relative flex items-center gap-0.5 rounded-md", active && "bg-brand-light")}>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={cn(
          "min-h-10 min-w-0 flex-1 truncate rounded-md px-2 py-2 text-left text-sm transition-colors duration-150 ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
          active ? "font-medium text-ink" : "text-ink hover:bg-surface-sunken",
        )}
      >
        {conversation.title}
      </button>
      <button
        ref={menuBtnRef}
        type="button"
        onClick={openMenu}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`Azioni per ${conversation.title}`}
        className="grid size-10 shrink-0 place-items-center rounded text-ink-subtle transition-colors duration-150 ease-out-quart hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <MoreVertical className="size-4" aria-hidden />
      </button>
      {menuOpen && menuPos && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            role="menu"
            style={{ top: menuPos.top, right: menuPos.right }}
            className="fixed z-40 w-48 rounded-md border border-line bg-surface p-1 shadow-pop"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setDraft(conversation.title);
                setMode("renaming");
              }}
              className="flex w-full items-center gap-2 rounded px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-surface-sunken"
            >
              <Pencil className="size-3.5" aria-hidden />
              Rinomina
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onArchive();
              }}
              className="flex w-full items-center gap-2 rounded px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-surface-sunken"
            >
              <Archive className="size-3.5" aria-hidden />
              Archivia
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setMode("deleting");
              }}
              className="flex w-full items-center gap-2 rounded px-3 py-2.5 text-left text-sm text-danger transition-colors hover:bg-danger/5"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Elimina
            </button>
          </div>
        </>
      )}
    </li>
  );
}
