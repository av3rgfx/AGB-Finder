"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, MessageSquarePlus } from "lucide-react";
import { api } from "@/trpc/react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ProductPanel } from "@/components/chat/product-panel";
import { ChatInput } from "@/components/chat/chat-input";

const EXAMPLE_PROMPTS = [
  "Cerniere per anta ribalta in acciaio",
  "Che cremonesi ARTECH avete sotto i 30 €?",
  "Dammi la scheda del codice B00590.15.03",
];

export function AssistenteClient() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  // Bolla ottimistica del messaggio utente per l'intero giro create+send.
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const utils = api.useUtils();
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversations = api.chat.list.useQuery();
  const thread = api.chat.get.useQuery(
    { conversationId: conversationId ?? "" },
    { enabled: conversationId !== null },
  );

  const invalidate = () => {
    void utils.chat.get.invalidate();
    void utils.chat.list.invalidate();
  };
  const create = api.chat.create.useMutation();
  const send = api.chat.send.useMutation({ onSettled: invalidate });
  const retry = api.chat.retry.useMutation({ onSettled: invalidate });
  const archive = api.chat.archive.useMutation({
    onSuccess: () => {
      setConversationId(null);
      void utils.chat.list.invalidate();
    },
  });

  const messages = thread.data?.messages ?? [];
  const products = thread.data?.products ?? [];
  const busy = send.isPending || retry.isPending || create.isPending;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy]);

  const handleSend = async (content: string) => {
    setPendingContent(content);
    try {
      let id = conversationId;
      if (!id) {
        id = (await create.mutateAsync()).id;
        setConversationId(id);
      }
      await send.mutateAsync({ conversationId: id, content });
    } catch {
      // Errore già rappresentato da send.isError (banner con «Riprova»).
    } finally {
      setPendingContent(null);
    }
  };

  const showEmptyState = messages.length === 0 && !busy && !thread.isLoading;

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] max-w-7xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Assistente</h1>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="conversazioni">
            Conversazioni recenti
          </label>
          <select
            id="conversazioni"
            value={conversationId ?? ""}
            onChange={(event) => setConversationId(event.target.value || null)}
            className="max-w-64 rounded border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="">Conversazioni recenti…</option>
            {(conversations.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          {conversationId && (
            <button
              type="button"
              onClick={() => archive.mutate({ conversationId })}
              disabled={archive.isPending}
              className="inline-flex items-center gap-1.5 rounded border border-line-strong px-3 py-2 text-sm text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50"
            >
              <Archive className="size-4" aria-hidden />
              Archivia
            </button>
          )}
          <button
            type="button"
            onClick={() => setConversationId(null)}
            className="inline-flex items-center gap-1.5 rounded bg-brand px-3 py-2 text-sm font-medium text-white transition-colors duration-150 ease-out-quart hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <MessageSquarePlus className="size-4" aria-hidden />
            Nuova conversazione
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-md border border-line bg-surface shadow-card lg:grid-cols-[3fr_2fr]">
        {/* Colonna chat (60%) */}
        <div className="flex min-h-0 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {showEmptyState ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <p className="max-w-sm text-sm text-ink-muted">
                  Chiedi all&apos;assistente informazioni su prodotti, codici e specifiche del
                  catalogo AGB.
                </p>
                <div className="flex flex-col gap-2">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void handleSend(prompt)}
                      className="rounded border border-line-strong px-4 py-2 text-sm text-ink transition-colors duration-150 ease-out-quart hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    role={message.role === "USER" ? "USER" : "ASSISTANT"}
                    content={message.content}
                    status={message.status}
                    errorMessage={message.errorMessage}
                    onRetry={
                      conversationId ? () => retry.mutate({ conversationId }) : undefined
                    }
                    retrying={retry.isPending}
                  />
                ))}
                {pendingContent && <MessageBubble role="USER" content={pendingContent} />}
                {busy && (
                  <p className="animate-pulse text-sm text-ink-muted" role="status">
                    Sta scrivendo…
                  </p>
                )}
                {send.isError && conversationId && (
                  <MessageBubble
                    role="ASSISTANT"
                    content=""
                    status="ERROR"
                    errorMessage={send.error.message}
                    onRetry={() => retry.mutate({ conversationId })}
                    retrying={retry.isPending}
                  />
                )}
                <div ref={bottomRef} />
              </>
            )}
          </div>
          <ChatInput onSend={(content) => void handleSend(content)} disabled={busy} />
        </div>

        {/* Pannello prodotti (40%) */}
        <aside
          aria-label="Prodotti citati"
          className="hidden min-h-0 border-l border-line bg-surface-page lg:block"
        >
          <ProductPanel products={products} />
        </aside>
      </div>
    </div>
  );
}
