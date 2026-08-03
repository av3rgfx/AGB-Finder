// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { applyChatEvent, useChatStream, type StreamState } from "./use-chat-stream";
import type { ChatEvent } from "@/lib/chat/chat-events";

const baseState: StreamState = {
  status: "streaming",
  text: "",
  tool: null,
  error: null,
  products: [],
  messageId: null,
};

describe("applyChatEvent (riduttore puro)", () => {
  it("delta: accoda il testo", () => {
    const s1 = applyChatEvent(baseState, { type: "delta", text: "Ciao" });
    const s2 = applyChatEvent(s1, { type: "delta", text: " mondo" });
    expect(s2.text).toBe("Ciao mondo");
  });

  it("tool start imposta l'etichetta, tool end la azzera", () => {
    const s1 = applyChatEvent(baseState, {
      type: "tool",
      phase: "start",
      tool: "search_products",
      label: "Sto cercando…",
    });
    expect(s1.tool).toBe("Sto cercando…");
    const s2 = applyChatEvent(s1, {
      type: "tool",
      phase: "end",
      tool: "search_products",
      label: "Sto cercando…",
    });
    expect(s2.tool).toBeNull();
  });

  it("done: popola prodotti/messageId, azzera tool, torna idle", () => {
    const s = applyChatEvent(
      { ...baseState, tool: "Sto cercando…", text: "Ciao" },
      {
        type: "done",
        messageId: "msg-1",
        products: [
          {
            id: "p1",
            agbCode: "A1",
            name: "Prodotto",
            shortDescription: null,
            basePrice: 1,
            priceUnit: "PZ",
            listinoPage: 3,
          },
        ],
        tokens: 42,
      },
    );
    expect(s.status).toBe("idle");
    expect(s.tool).toBeNull();
    expect(s.messageId).toBe("msg-1");
    expect(s.products).toHaveLength(1);
    expect(s.text).toBe("Ciao"); // il testo non viene toccato dall'evento done
  });

  it("error recuperabile: surfaces retryAfter", () => {
    const s = applyChatEvent(baseState, {
      type: "error",
      recoverable: true,
      retryAfter: 30,
      message: "Assistente occupato",
    });
    expect(s.status).toBe("error");
    expect(s.error).toEqual({ recoverable: true, retryAfter: 30, message: "Assistente occupato" });
  });

  it("error fatale: recoverable false, retryAfter assente", () => {
    const s = applyChatEvent(baseState, {
      type: "error",
      recoverable: false,
      message: "Errore imprevisto",
    });
    expect(s.error).toEqual({
      recoverable: false,
      retryAfter: undefined,
      message: "Errore imprevisto",
    });
  });
});

// --- fixture SSE lato test -------------------------------------------------

const enc = new TextEncoder();
function frame(ev: ChatEvent): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(ev)}\n\n`);
}

/** Stream che emette tutti gli eventi indicati e poi si chiude. */
function closedStream(events: ChatEvent[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const ev of events) controller.enqueue(frame(ev));
      controller.close();
    },
  });
}

function mkAbortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

/**
 * Stream controllabile a mano dal test: `push` accoda un evento (subito visibile alla prossima
 * `read()`), `close` chiude normalmente. Se il `signal` passato viene abortito mentre lo stream è
 * "in ascolto" (nessun push pendente), la `read()` in corso rigetta con AbortError — simula lo
 * STOP che interrompe una richiesta ancora a metà.
 */
function controllableStream(signal: AbortSignal) {
  const queue: Uint8Array[] = [];
  let pullReject: ((err: unknown) => void) | null = null;
  let pullResolve: (() => void) | null = null;
  let closed = false;

  signal.addEventListener("abort", () => pullReject?.(mkAbortError()));

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (queue.length > 0) {
        controller.enqueue(queue.shift()!);
        return;
      }
      if (closed) {
        controller.close();
        return;
      }
      if (signal.aborted) return Promise.reject(mkAbortError());
      return new Promise<void>((resolve, reject) => {
        pullResolve = resolve;
        pullReject = reject;
      }).then(() => {
        if (queue.length > 0) controller.enqueue(queue.shift()!);
        else if (closed) controller.close();
      });
    },
  });

  return {
    stream,
    push(ev: ChatEvent) {
      queue.push(frame(ev));
      pullResolve?.();
      pullResolve = null;
      pullReject = null;
    },
    close() {
      closed = true;
      pullResolve?.();
      pullResolve = null;
      pullReject = null;
    },
  };
}

describe("useChatStream", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("batching dei delta: il testo finale è la concatenazione di tutti i chunk", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: closedStream([
        { type: "delta", text: "Ciao" },
        { type: "delta", text: " mondo" },
        { type: "delta", text: "!" },
        { type: "done", messageId: "m1", products: [], tokens: 3 },
      ]),
    } as Response);

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start({ conversationId: "c1", content: "hi", mode: "send" });
    });

    expect(result.current.state.text).toBe("Ciao mondo!");
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.messageId).toBe("m1");
  });

  it("non flusha il testo prima del frame, poi lo flusha in un colpo solo", async () => {
    let ctl!: ReturnType<typeof controllableStream>;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      ctl = controllableStream(init.signal as AbortSignal);
      return Promise.resolve({ ok: true, status: 200, body: ctl.stream } as Response);
    });

    const { result } = renderHook(() => useChatStream());
    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.start({ conversationId: "c1", content: "hi", mode: "send" });
    });
    await waitFor(() => expect(ctl).toBeDefined());

    act(() => {
      ctl.push({ type: "delta", text: "Ciao" });
      ctl.push({ type: "delta", text: " mondo" });
    });
    // Subito dopo l'invio dei delta, prima che scatti il frame batchato, il testo non è ancora
    // nello stato (è solo nel buffer interno).
    expect(result.current.state.text).toBe("");

    await waitFor(() => expect(result.current.state.text).toBe("Ciao mondo"));

    act(() => {
      ctl.push({ type: "done", messageId: "m1", products: [], tokens: 2 });
      ctl.close();
    });
    await act(async () => {
      await startPromise;
    });
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.messageId).toBe("m1");
  });

  it("hasText(): vero appena arriva il primo delta, anche prima del frame che lo riversa nello stato", async () => {
    // rAF congelato: il buffer non viene mai riversato da solo, così il test riproduce in modo
    // deterministico l'istante (~16 ms) in cui `state.text` è ancora vuoto ma del testo dal server
    // è già arrivato. Uno STOP premuto lì deve comunque sapere che c'è un parziale da attendere.
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});

    let ctl!: ReturnType<typeof controllableStream>;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      ctl = controllableStream(init.signal as AbortSignal);
      return Promise.resolve({ ok: true, status: 200, body: ctl.stream } as Response);
    });

    const { result } = renderHook(() => useChatStream());
    expect(result.current.hasText()).toBe(false);

    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.start({ conversationId: "c1", content: "hi", mode: "send" });
    });
    await waitFor(() => expect(ctl).toBeDefined());

    act(() => {
      ctl.push({ type: "delta", text: "Ecco le" });
    });
    await waitFor(() => expect(result.current.hasText()).toBe(true));
    expect(result.current.state.text).toBe(""); // ancora solo nel buffer

    act(() => {
      ctl.push({ type: "done", messageId: "m1", products: [], tokens: 1 });
      ctl.close();
    });
    await act(async () => {
      await startPromise;
    });
    // Il flush esplicito prima dell'evento terminale riversa comunque il buffer.
    expect(result.current.state.text).toBe("Ecco le");

    act(() => result.current.reset());
    expect(result.current.hasText()).toBe(false);
  });

  it("stop() aborta la richiesta e mantiene il testo parziale senza impostare un errore", async () => {
    let ctl!: ReturnType<typeof controllableStream>;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      ctl = controllableStream(init.signal as AbortSignal);
      return Promise.resolve({ ok: true, status: 200, body: ctl.stream } as Response);
    });

    const { result } = renderHook(() => useChatStream());
    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.start({ conversationId: "c1", content: "hi", mode: "send" });
    });
    await waitFor(() => expect(ctl).toBeDefined());

    act(() => {
      ctl.push({ type: "delta", text: "Parziale" });
    });
    await waitFor(() => expect(result.current.state.text).toBe("Parziale"));

    act(() => {
      result.current.stop();
    });
    await act(async () => {
      await startPromise;
    });

    expect(result.current.state.text).toBe("Parziale");
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.error).toBeNull();
  });

  it("evento error recuperabile: retryAfter arriva nello stato", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: closedStream([
        {
          type: "error",
          recoverable: true,
          retryAfter: 20,
          message: "Assistente momentaneamente occupato",
        },
      ]),
    } as Response);

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start({ conversationId: "c1", content: "hi", mode: "send" });
    });

    expect(result.current.state.status).toBe("error");
    expect(result.current.state.error).toEqual({
      recoverable: true,
      retryAfter: 20,
      message: "Assistente momentaneamente occupato",
    });
  });

  it("risposta HTTP 401 produce un errore fatale in italiano, non un no-op silenzioso", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, body: null } as unknown as Response);

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start({ conversationId: "c1", content: "hi", mode: "send" });
    });

    expect(result.current.state.status).toBe("error");
    expect(result.current.state.error?.recoverable).toBe(false);
    expect(result.current.state.error?.message).toMatch(/accesso/i);
  });

  it("reset() riporta lo stato iniziale", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: closedStream([
        { type: "delta", text: "Ciao" },
        { type: "done", messageId: "m1", products: [], tokens: 1 },
      ]),
    } as Response);

    const { result } = renderHook(() => useChatStream());
    await act(async () => {
      await result.current.start({ conversationId: "c1", content: "hi", mode: "send" });
    });
    expect(result.current.state.text).toBe("Ciao");

    act(() => result.current.reset());
    expect(result.current.state).toEqual({
      status: "idle",
      text: "",
      tool: null,
      error: null,
      products: [],
      messageId: null,
    });
  });

  it("start() richiamato mentre il precedente è in corso: la risposta tardiva del vecchio fetch non corrompe lo stato del nuovo", async () => {
    let resolveFirst!: (r: Response) => void;
    const firstFetch = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    fetchMock
      .mockImplementationOnce(() => firstFetch)
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          body: closedStream([
            { type: "delta", text: "Nuovo" },
            { type: "done", messageId: "new-msg", products: [], tokens: 1 },
          ]),
        } as Response),
      );

    const { result } = renderHook(() => useChatStream());
    let firstStart!: Promise<void>;
    act(() => {
      firstStart = result.current.start({ conversationId: "c1", content: "vecchia", mode: "send" });
    });

    let secondStart!: Promise<void>;
    await act(async () => {
      secondStart = result.current.start({ conversationId: "c1", content: "nuova", mode: "send" });
      await secondStart;
    });
    expect(result.current.state.text).toBe("Nuovo");
    expect(result.current.state.messageId).toBe("new-msg");

    // La prima fetch, ormai superata, si risolve solo adesso: non deve toccare lo stato corrente.
    await act(async () => {
      resolveFirst({
        ok: true,
        status: 200,
        body: closedStream([
          { type: "delta", text: "VECCHIO" },
          { type: "done", messageId: "old-msg", products: [], tokens: 1 },
        ]),
      } as Response);
      await firstStart;
      await secondStart;
    });

    expect(result.current.state.text).toBe("Nuovo");
    expect(result.current.state.messageId).toBe("new-msg");
  });
});
