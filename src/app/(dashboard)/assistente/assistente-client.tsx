"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen, Plus, Sparkles, X } from "lucide-react";
import { api } from "@/trpc/react";
import { useChatStream, type StartInput } from "@/hooks/use-chat-stream";
import { Composer } from "@/components/chat/composer";
import { ToolStatus } from "@/components/chat/tool-status";
import { ErrorBanner } from "@/components/chat/error-banner";
import { ScrollToBottom } from "@/components/chat/scroll-to-bottom";
import { MessageTurn } from "@/components/chat/message-turn";
import { ConversationsPanel } from "@/components/chat/conversations-panel";
import { isNearBottom } from "@/lib/chat/scroll";
import { cn } from "@/lib/utils";

const EXAMPLE_PROMPTS = [
  "Cerniere per anta ribalta in acciaio",
  "Che cremonesi ARTECH avete sotto i 30 €?",
  "Dammi la scheda del codice B00590.15.03",
];

/** Numero massimo di ritentativi automatici su un errore recuperabile (rate limit) prima di
 * lasciare solo il bottone «Riprova» manuale — vedi l'effetto `useEffect` di auto-retry sotto. */
const MAX_AUTO_RETRIES = 2;
const DEFAULT_RETRY_DELAY_S = 5;

/** STOP: il server scrive la risposta parziale solo DOPO aver rilevato la disconnessione, quindi il
 * refetch che segue l'abort può arrivare prima di quella scrittura. Si ri-invalida `chat.get` un
 * numero limitato di volte in attesa della riga; poi si rinuncia (comparirà al prossimo
 * caricamento) per non tenere il turno live montato all'infinito. */
const STOP_PERSIST_ATTEMPTS = 3;
const STOP_PERSIST_RETRY_MS = 500;

export function AssistenteClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const conversationId = searchParams.get("c");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [pendingUserContent, setPendingUserContent] = useState<string | null>(null);
  const [nearBottom, setNearBottom] = useState(true);

  const utils = api.useUtils();
  const { state, start, stop, reset } = useChatStream();

  const conversations = api.chat.list.useQuery();
  const thread = api.chat.get.useQuery(
    { conversationId: conversationId ?? "" },
    { enabled: conversationId !== null },
  );
  const create = api.chat.create.useMutation();
  const renameMut = api.chat.rename.useMutation({
    onSuccess: (_data, variables) => {
      void utils.chat.list.invalidate();
      void utils.chat.get.invalidate({ conversationId: variables.conversationId });
    },
  });
  const deleteMut = api.chat.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.chat.list.invalidate();
      if (variables.conversationId === conversationId) router.replace(pathname, { scroll: false });
    },
  });
  const archiveMut = api.chat.archive.useMutation({
    onSuccess: (_data, variables) => {
      void utils.chat.list.invalidate();
      if (variables.conversationId === conversationId) router.replace(pathname, { scroll: false });
    },
  });

  const persistedMessages = thread.data?.messages ?? [];
  const persistedIds = new Set(persistedMessages.map((m) => m.id));
  const lastPersistedAssistantId = (() => {
    for (let i = persistedMessages.length - 1; i >= 0; i--) {
      if (persistedMessages[i]!.role === "ASSISTANT") return persistedMessages[i]!.id;
    }
    return null;
  })();

  // STOP con del testo già ricevuto: fotografa l'ultima riga ASSISTANT presente al momento
  // dell'abort. Finché in `chat.get` non ne compare una DIVERSA (= il parziale scritto dal server è
  // atterrato nella cache), il turno live resta montato — altrimenti, tornando `status: "idle"` con
  // `messageId === null`, il turno si smonterebbe e il testo parziale sparirebbe dallo schermo fino
  // al refetch (che con quella scrittura è in corsa). Il testo non è mai perso nel DB, ma la
  // promessa «lo STOP mantiene visibile la risposta parziale» va rispettata anche a schermo.
  const [stopAwaitAfterId, setStopAwaitAfterId] = useState<{ id: string | null } | null>(null);
  const awaitingStopPersist =
    stopAwaitAfterId !== null && lastPersistedAssistantId === stopAwaitAfterId.id;

  // Round corrente (send o regenerate) "in volo": dallo start esplicito fino a quando la riga
  // persistita compare in `chat.get` (successo) oppure resta in errore (nessun'altra riga arriverà
  // finché l'utente non ritenta). Guida sia la bolla utente ottimistica sia quella assistant live.
  const modeRef = useRef<"send" | "regenerate" | null>(null);
  const liveMessageLanded = state.messageId !== null && persistedIds.has(state.messageId);
  const turnInFlight =
    state.status === "streaming" ||
    state.status === "error" ||
    (state.messageId !== null && !liveMessageLanded) ||
    awaitingStopPersist;

  // Rigenera ha appena cancellato l'ultima riga ASSISTANT lato server (vedi ChatService): finché la
  // cache locale non si aggiorna, nascondiamo otticamente quella riga stale per non mostrarla insieme
  // alla bolla live della nuova risposta in arrivo.
  let displayedMessages = persistedMessages;
  if (turnInFlight && modeRef.current === "regenerate") {
    const last = displayedMessages[displayedMessages.length - 1];
    if (last?.role === "ASSISTANT") displayedMessages = displayedMessages.slice(0, -1);
  }
  const lastAssistantIndex = (() => {
    for (let i = displayedMessages.length - 1; i >= 0; i--) {
      if (displayedMessages[i]!.role === "ASSISTANT") return i;
    }
    return -1;
  })();

  // La bolla utente ottimistica serve solo finché la riga USER persistita non è comparsa in
  // `chat.get`. Quando il turno resta "in volo" ANCHE dopo che il refetch è atterrato — turno finito
  // in errore (il banner resta montato) o STOP in attesa della scrittura del parziale — la riga
  // persistita e la bolla ottimistica mostrerebbero due volte lo stesso messaggio.
  const lastDisplayed = displayedMessages[displayedMessages.length - 1];
  const pendingUserBubble =
    turnInFlight &&
    pendingUserContent !== null &&
    modeRef.current === "send" &&
    !(lastDisplayed?.role === "USER" && lastDisplayed.content === pendingUserContent)
      ? pendingUserContent
      : null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guardia contro una corsa specifica: creare una conversazione e inviarci subito il primo
  // messaggio scrive `?c=<nuovo-id>` nell'URL MENTRE lo stream è già partito. Senza questa guardia,
  // l'effetto "cambio conversazione" sotto (che interrompe uno stream in corso quando si cambia
  // conversazione) scambierebbe quella transizione null→id per un cambio-conversazione e
  // interromperebbe lo stream appena avviato. Impostata subito prima di scrivere l'URL in
  // `handleSend` ALL'ID SPECIFICO appena creato (non un booleano): `router.replace` non è sincrono,
  // quindi se prima che quella transizione atterri arriva un'altra `router.replace` (es. l'utente
  // seleziona un'altra conversazione), `conversationId` può saltare direttamente null→altroId
  // scavalcando l'id creato — una guardia booleana "cieca" lascerebbe quel salto senza reset,
  // orfanando lo stream appena partito. Legandola all'id, l'effetto sotto protegge SOLO l'esatta
  // transizione null→id-creato; qualunque altro salto (incluso lo scavalcamento) fa il reset normale.
  const skipResetForIdRef = useRef<string | null>(null);
  // `conversationId` "dal vivo": sincronizzato a ogni render (non in un effetto) così il cleanup
  // dell'effetto sotto — che appartiene all'istanza PRECEDENTE e quindi non vede per chiusura il
  // nuovo valore verso cui si sta transitando — può leggerlo quando scatta, per confrontarlo con
  // `skipResetForIdRef`.
  const latestConversationIdRef = useRef(conversationId);
  latestConversationIdRef.current = conversationId;

  const performTurn = useCallback(
    async (input: StartInput) => {
      modeRef.current = input.mode;
      setStopAwaitAfterId(null); // nuovo turno: l'attesa del parziale di uno STOP precedente decade
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      await start(input);
      await Promise.all([
        utils.chat.get.invalidate({ conversationId: input.conversationId }),
        utils.chat.list.invalidate(),
      ]);
    },
    [start, utils],
  );

  const handleSend = useCallback(
    async (content: string) => {
      let id = conversationId;
      if (!id) {
        const created = await create.mutateAsync();
        id = created.id;
        skipResetForIdRef.current = id;
        router.replace(`${pathname}?c=${id}`, { scroll: false });
      }
      retryCountRef.current = 0;
      setPendingUserContent(content);
      await performTurn({ conversationId: id, content, mode: "send" });
    },
    [conversationId, create, pathname, router, performTurn],
  );

  // «Rigenera»/«Riprova» sono sempre lo stesso flusso `mode: "regenerate"`, sia per rifare l'ultima
  // risposta completata sia per ritentare un round fallito. Il retry di un send appena tentato è
  // sicuro perché `deleteLastAssistant` lato server cancella SOLO se l'ultima riga della
  // conversazione è davvero una risposta appena prodotta: se il turno è morto prima di produrne una
  // (l'ultima riga è il messaggio USER), non tocca nulla — in particolare non la risposta del turno
  // PRECEDENTE. Vedi ChatService.deleteLastAssistant.
  const handleRegenerate = useCallback(async () => {
    if (!conversationId) return;
    retryCountRef.current = 0;
    await performTurn({ conversationId, mode: "regenerate" });
  }, [conversationId, performTurn]);

  // Auto-retry su errore recuperabile (rate limit): al massimo MAX_AUTO_RETRIES tentativi
  // automatici rispettando `retryAfter`, poi resta solo il bottone manuale del banner.
  useEffect(() => {
    if (state.status !== "error" || !state.error?.recoverable || !conversationId) return;
    if (retryCountRef.current >= MAX_AUTO_RETRIES) return;
    retryCountRef.current += 1;
    const delayMs = (state.error.retryAfter ?? DEFAULT_RETRY_DELAY_S) * 1000;
    const id = conversationId;
    const timer = setTimeout(() => {
      void performTurn({ conversationId: id, mode: "regenerate" });
    }, delayMs);
    retryTimerRef.current = timer;
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- performTurn dipende solo da start/utils, stabili
  }, [state.status, state.error, conversationId]);

  // STOP dell'utente: oltre ad abortire lo stream, se c'è già del testo parziale si arma l'attesa
  // della riga che il server sta per scrivere (vedi `awaitingStopPersist`). Senza testo il server
  // non persiste nulla (vedi ChatService), quindi non c'è niente da attendere.
  const handleStop = useCallback(() => {
    stop();
    if (state.text.length > 0) setStopAwaitAfterId({ id: lastPersistedAssistantId });
  }, [stop, state.text, lastPersistedAssistantId]);

  // Attesa attiva della riga scritta dopo lo STOP: si ri-invalida `chat.get` a intervalli, fino a
  // STOP_PERSIST_ATTEMPTS, poi si rinuncia (il turno live si smonta e resta la cache com'è).
  useEffect(() => {
    if (!awaitingStopPersist || !conversationId) return;
    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      if (attempts > STOP_PERSIST_ATTEMPTS) {
        clearInterval(id);
        setStopAwaitAfterId(null);
        return;
      }
      void utils.chat.get.invalidate({ conversationId });
    }, STOP_PERSIST_RETRY_MS);
    return () => clearInterval(id);
  }, [awaitingStopPersist, conversationId, utils]);

  const handleManualRetry = useCallback(() => {
    retryCountRef.current = 0;
    if (!conversationId) return;
    void performTurn({ conversationId, mode: "regenerate" });
  }, [conversationId, performTurn]);

  const handleNewConversation = useCallback(() => {
    router.replace(pathname, { scroll: false });
    setDrawerOpen(false);
  }, [router, pathname]);

  const handleSelect = useCallback(
    (id: string) => {
      router.replace(`${pathname}?c=${id}`, { scroll: false });
      setDrawerOpen(false);
    },
    [router, pathname],
  );

  // Cambio conversazione (incluso il "torna vuoto" di delete/archive sull'attiva): interrompe uno
  // stream in corso e azzera lo stato transitorio, così nessun evento residuo del vecchio round
  // finisce mischiato nella nuova conversazione. ECCEZIONE: l'esatta transizione null→id appena
  // creato da `handleSend` (vedi `skipResetForIdRef`) — lì lo stream è appena partito e va lasciato
  // proseguire, non interrotto. La guardia è scoped all'id: il body (che riceve `conversationId`,
  // cioè il valore IN ARRIVO, per chiusura) decide se questa run è la transizione protetta; il
  // cleanup, che appartiene invece all'istanza PRECEDENTE, non vede quel valore per chiusura e lo
  // legge "dal vivo" da `latestConversationIdRef` (sincronizzato a ogni render, quindi già
  // aggiornato quando il cleanup scatta) per confrontarlo con `skipResetForIdRef`. In ogni caso che
  // non sia esattamente quella transizione — inclusa una corsa che scavalca l'id protetto saltando
  // direttamente verso un'altra conversazione — si esegue il reset normale, e la guardia viene
  // comunque azzerata (consumata o invalidata) così non può più sopravvivere a proteggere una
  // transizione futura.
  useEffect(() => {
    const isProtectedTransition =
      conversationId !== null && conversationId === skipResetForIdRef.current;
    skipResetForIdRef.current = null;
    if (!isProtectedTransition) {
      nearBottomRef.current = true;
      setNearBottom(true);
      setPendingUserContent(null);
      setDrawerOpen(false);
      setStopAwaitAfterId(null);
      modeRef.current = null;
      retryCountRef.current = 0;
    }
    return () => {
      const stillProtected =
        latestConversationIdRef.current !== null &&
        latestConversationIdRef.current === skipResetForIdRef.current;
      if (!stillProtected) reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambio di conversationId
  }, [conversationId]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const v = isNearBottom(scrollRef.current);
    nearBottomRef.current = v;
    setNearBottom(v);
  };
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    nearBottomRef.current = true;
    setNearBottom(true);
  };
  useEffect(() => {
    if (nearBottomRef.current) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [displayedMessages.length, pendingUserContent, state.text, state.tool]);

  const activeTitle =
    thread.data?.conversation.title ??
    conversations.data?.find((c) => c.id === conversationId)?.title;
  const showEmptyState = displayedMessages.length === 0 && !turnInFlight && !thread.isLoading;

  const conversationsPanel = (
    <ConversationsPanel
      items={conversations.data ?? []}
      activeId={conversationId}
      search={search}
      onSearch={setSearch}
      onSelect={handleSelect}
      onNew={handleNewConversation}
      onRename={(id, title) => renameMut.mutate({ conversationId: id, title })}
      onDelete={(id) => deleteMut.mutate({ conversationId: id })}
      onArchive={(id) => archiveMut.mutate({ conversationId: id })}
    />
  );

  return (
    <div className="flex h-[calc(100dvh-6rem)] overflow-hidden rounded-md border border-line bg-surface shadow-card sm:h-[calc(100dvh-7rem)]">
      {/* Rail desktop, collassabile. */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col overflow-hidden border-r border-line bg-surface-page transition-[width] duration-200 ease-out-quart lg:flex",
          railOpen ? "lg:w-[280px]" : "lg:w-0 lg:border-r-0",
        )}
      >
        <div className="w-[280px] flex-1 p-3">{conversationsPanel}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-2 sm:px-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Apri elenco conversazioni"
            className="grid size-10 shrink-0 place-items-center rounded text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setRailOpen((v) => !v)}
            aria-label={railOpen ? "Comprimi elenco conversazioni" : "Espandi elenco conversazioni"}
            aria-expanded={railOpen}
            className="hidden size-10 shrink-0 place-items-center rounded text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 lg:grid"
          >
            {railOpen ? (
              <PanelLeftClose className="size-5" aria-hidden />
            ) : (
              <PanelLeftOpen className="size-5" aria-hidden />
            )}
          </button>
          <h1 className="min-w-0 flex-1 truncate px-1 text-sm font-medium text-ink sm:text-base">
            {activeTitle ?? "Assistente"}
          </h1>
          <button
            type="button"
            onClick={handleNewConversation}
            aria-label="Nuova conversazione"
            className="grid size-10 shrink-0 place-items-center rounded text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <Plus className="size-5" aria-hidden />
          </button>
        </header>

        {/* `relative` è l'ancora di ScrollToBottom (`absolute bottom-20`): essendo un fratello
            flex-1 della Composer, quando quest'ultima cresce (textarea fino a 6 righe + safe-area)
            questo contenitore si restringe di conseguenza — bottom-20 resta sempre "80px sopra la
            Composer", mai sovrapposto, senza bisogno di misurarne l'altezza via JS. Verificato anche
            visivamente a 375px con textarea al massimo. */}
        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            aria-live="polite"
            aria-busy={state.status === "streaming"}
            className="h-full overflow-y-auto px-3 py-4 sm:px-4"
          >
            {showEmptyState ? (
              <EmptyState onPick={(p) => void handleSend(p)} />
            ) : thread.isLoading ? (
              <p className="py-8 text-center text-sm text-ink-subtle">Caricamento…</p>
            ) : (
              <div className="mx-auto flex max-w-[760px] flex-col gap-4">
                {displayedMessages.map((message, i) => (
                  <MessageTurn
                    key={message.id}
                    role={message.role === "USER" ? "USER" : "ASSISTANT"}
                    content={message.content}
                    status={message.status}
                    errorMessage={message.errorMessage}
                    products={message.products}
                    onRegenerate={
                      !turnInFlight && i === lastAssistantIndex ? handleRegenerate : undefined
                    }
                  />
                ))}
                {pendingUserBubble !== null && (
                  <MessageTurn role="USER" content={pendingUserBubble} />
                )}
                {turnInFlight && state.status !== "error" && (
                  <div className="flex flex-col gap-2">
                    {state.tool && <ToolStatus label={state.tool} />}
                    <MessageTurn
                      role="ASSISTANT"
                      content={state.text}
                      streaming={state.status === "streaming"}
                      products={state.products}
                    />
                  </div>
                )}
                {turnInFlight && state.status === "error" && state.error && (
                  <ErrorBanner error={state.error} onRetry={handleManualRetry} />
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
          <ScrollToBottom onClick={scrollToBottom} visible={!nearBottom && !showEmptyState} />
        </div>

        <div className="mx-auto w-full max-w-[760px] shrink-0">
          <Composer
            onSend={(content) => void handleSend(content)}
            streaming={state.status === "streaming"}
            onStop={handleStop}
            disabled={create.isPending}
          />
        </div>
      </div>

      {/* Drawer conversazioni mobile — stesso pattern di TopBar (backdrop + animate-drawer-in +
          Esc + body-scroll-lock). */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Conversazioni"
        >
          <button
            type="button"
            aria-label="Chiudi elenco conversazioni"
            onClick={() => setDrawerOpen(false)}
            className="animate-fade-in absolute inset-0 bg-ink/40"
          />
          <div className="animate-drawer-in absolute inset-y-0 left-0 flex w-[85%] max-w-[320px] flex-col bg-surface p-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-modal">
            <div className="mb-2 flex shrink-0 justify-end">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Chiudi elenco conversazioni"
                className="grid size-10 place-items-center rounded text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1">{conversationsPanel}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
      <Sparkles className="size-8 text-brand" aria-hidden />
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium text-ink">Chiedi all&apos;assistente</p>
        <p className="text-sm text-ink-subtle">
          Informazioni su prodotti, codici e specifiche del catalogo AGB.
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="rounded-lg border border-line-strong px-4 py-2.5 text-left text-sm text-ink transition-colors duration-150 ease-out-quart hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
