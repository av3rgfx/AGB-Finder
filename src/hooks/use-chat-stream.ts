"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createParser } from "eventsource-parser";
import type { ChatEvent, ChatProductSummary } from "@/lib/chat/chat-events";

// DEROGA UNICA alla regola "tutte le API via tRPC, mai fetch diretto dal client" (CLAUDE.md):
// lo streaming SSE di `POST /api/chat/stream` non è esprimibile su `httpBatchLink`. La deroga è
// confinata a questo file soltanto — nessun altro punto del client deve fare `fetch` diretto.
// La conversazione persistita viene ri-letta via tRPC dal chiamante dopo l'evento `done`: questo
// hook tiene solo lo stato transitorio dello streaming in corso.

export interface StreamState {
  status: "idle" | "streaming" | "error";
  text: string;
  tool: string | null;
  error: { recoverable: boolean; retryAfter?: number; message: string } | null;
  products: ChatProductSummary[];
  messageId: string | null;
}

export interface StartInput {
  conversationId: string;
  content?: string;
  mode: "send" | "regenerate";
}

const initialState: StreamState = {
  status: "idle",
  text: "",
  tool: null,
  error: null,
  products: [],
  messageId: null,
};

/**
 * Riduttore puro evento-SSE → stato. Isolato dal fetch/rAF per essere testabile senza DOM:
 * i delta arrivano già "in batch" (il testo accumulato di un frame di rAF), tool/done/error
 * arrivano uno a uno così come li manda il server.
 */
export function applyChatEvent(state: StreamState, event: ChatEvent): StreamState {
  switch (event.type) {
    case "delta":
      return { ...state, text: state.text + event.text };
    case "tool":
      return { ...state, tool: event.phase === "start" ? event.label : null };
    case "done":
      return {
        ...state,
        status: "idle",
        tool: null,
        products: event.products,
        messageId: event.messageId,
      };
    case "error":
      return {
        ...state,
        status: "error",
        tool: null,
        error: {
          recoverable: event.recoverable,
          retryAfter: event.retryAfter,
          message: event.message,
        },
      };
    default:
      // Difensivo: `JSON.parse(...) as ChatEvent` è un'asserzione, non una validazione — un
      // `type` non riconosciuto (skew di versione client/server) non deve produrre `undefined`.
      return state;
  }
}

function httpErrorMessage(status: number): { recoverable: boolean; message: string } {
  if (status === 401)
    return { recoverable: false, message: "Sessione scaduta: effettua di nuovo l'accesso." };
  if (status === 400) return { recoverable: false, message: "Richiesta non valida." };
  if (status === 404) return { recoverable: false, message: "Conversazione non trovata." };
  if (status === 429) return { recoverable: true, message: "Troppe richieste: riprova tra poco." };
  return { recoverable: false, message: "Errore di rete." };
}

function isAbortError(err: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      err instanceof DOMException &&
      err.name === "AbortError") ||
    (err as { name?: string } | undefined)?.name === "AbortError"
  );
}

export function useChatStream(): {
  state: StreamState;
  start(input: StartInput): Promise<void>;
  stop(): void;
  reset(): void;
} {
  const [state, setState] = useState<StreamState>(initialState);
  const abortRef = useRef<AbortController | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufferRef = useRef("");

  // Annulla il frame in sospeso senza toccare lo stato React (usato da start/reset/unmount).
  const cancelPendingFrame = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Svuota il buffer accumulato dai delta nello stato. Va sempre chiamato prima di un evento
  // terminale (done/error/abort) così nessun delta bufferizzato resta invisibile.
  const flush = useCallback(() => {
    rafRef.current = null;
    const chunk = bufferRef.current;
    bufferRef.current = "";
    if (chunk) setState((s) => applyChatEvent(s, { type: "delta", text: chunk }));
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const start = useCallback(
    async (input: StartInput) => {
      // Richiesta precedente ancora in corso: annullala e riparti da zero (buffer/frame inclusi,
      // altrimenti un delta del vecchio stream potrebbe finire mischiato al nuovo).
      abortRef.current?.abort();
      cancelPendingFrame();
      bufferRef.current = "";

      const ac = new AbortController();
      abortRef.current = ac;
      const isCurrent = () => abortRef.current === ac;

      setState({ ...initialState, status: "streaming" });

      try {
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: ac.signal,
        });
        if (!isCurrent()) return;

        if (!res.ok || !res.body) {
          const { recoverable, message } = res.ok
            ? { recoverable: false, message: "Errore di rete." }
            : httpErrorMessage(res.status);
          setState((s) => ({ ...s, status: "error", error: { recoverable, message } }));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        const handleEvent = (ev: ChatEvent) => {
          if (!isCurrent()) return;
          if (ev.type === "delta") {
            bufferRef.current += ev.text;
            if (rafRef.current == null) rafRef.current = requestAnimationFrame(flush);
            return;
          }
          if (ev.type === "tool") {
            setState((s) => applyChatEvent(s, ev));
            return;
          }
          // done / error: evento terminale, prima si svuota il buffer poi si applica il patch.
          cancelPendingFrame();
          flush();
          setState((s) => applyChatEvent(s, ev));
        };

        const parser = createParser({
          onEvent: (e) => handleEvent(JSON.parse(e.data) as ChatEvent),
        });

        for (;;) {
          const { done, value } = await reader.read();
          if (!isCurrent()) return;
          if (value) parser.feed(decoder.decode(value, { stream: true }));
          if (done) break;
        }

        // Il reader si è chiuso senza un evento terminale (done/error) esplicito, es. connessione
        // interrotta: non lasciare lo stato bloccato su "streaming" a tempo indefinito.
        cancelPendingFrame();
        flush();
        setState((s) =>
          s.status === "streaming"
            ? applyChatEvent(s, {
                type: "error",
                recoverable: false,
                message: "Connessione interrotta prima del completamento.",
              })
            : s,
        );
      } catch (err) {
        if (!isCurrent()) return;
        if (isAbortError(err)) {
          // STOP dell'utente: il server ha già persistito il parziale, non è un errore. Si tiene
          // il testo accumulato finora e si torna a uno stato non-error.
          cancelPendingFrame();
          flush();
          setState((s) => ({ ...s, status: "idle", tool: null }));
          return;
        }
        cancelPendingFrame();
        setState((s) => ({
          ...s,
          status: "error",
          tool: null,
          error: { recoverable: false, message: "Errore di connessione." },
        }));
      }
    },
    [cancelPendingFrame, flush],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    // A differenza di `stop()` (che lascia `abortRef` invariato apposta, per far comunque
    // atterrare l'aggiornamento "STOP → testo parziale mantenuto"), qui si azzera: dopo un
    // `reset()` nessun callback del vecchio stream deve più poter toccare lo stato, nemmeno se
    // arriva un evento residuo prima che l'abort si propaghi davvero alla rete.
    abortRef.current = null;
    cancelPendingFrame();
    bufferRef.current = "";
    setState(initialState);
  }, [cancelPendingFrame]);

  // Pulizia allo smontaggio: nessun frame in sospeso, nessuna richiesta orfana in corso.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { state, start, stop, reset };
}
