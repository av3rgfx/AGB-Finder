// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { useSyncExternalStore } from "react";
import { render, screen, cleanup, fireEvent, act, within } from "@testing-library/react";

// jsdom non implementa `Element.prototype.scrollIntoView` (nessuna nozione di layout/scroll
// reale): l'auto-scroll del componente lo chiama sull'elemento sentinella a ogni nuovo
// messaggio/delta, quindi va stubbato perché il test non esploda.
Element.prototype.scrollIntoView = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/listino/listino-viewer-provider", () => ({
  useListinoViewer: () => ({ open: vi.fn() }),
}));

// Piccolo store esterno (pattern useSyncExternalStore) che permette al test di pilotare, tra un
// render e l'altro, sia lo stato dell'hook `useChatStream` sia i dati mock di `chat.get`/`chat.list`
// — serve a simulare "lo stream avanza" e "l'invalidate/refetch è arrivato" in momenti distinti,
// per verificare l'handover bolla-live → riga-persistita senza duplicati.
const store = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  return {
    subscribe: (cb: () => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    notify,
    thread: { data: undefined as unknown, isLoading: false },
    conversationsList: [] as { id: string; title: string; updatedAt: Date }[],
    stream: {
      status: "idle" as "idle" | "streaming" | "error",
      text: "",
      tool: null as string | null,
      error: null as { recoverable: boolean; retryAfter?: number; message: string } | null,
      products: [] as unknown[],
      messageId: null as string | null,
    },
    startMock: vi.fn(async () => {}),
    stopMock: vi.fn(),
    resetMock: vi.fn(),
    createMutateAsync: vi.fn(async () => ({ id: "new-conv", title: "Nuova conversazione" })),
    renameMock: vi.fn(),
    deleteMock: vi.fn(),
    archiveMock: vi.fn(),
    invalidateGetMock: vi.fn(async () => {}),
    invalidateListMock: vi.fn(async () => {}),
  };
});

function setThread(data: unknown, isLoading = false) {
  store.thread = { data, isLoading };
  store.notify();
}
function setStream(next: Partial<typeof store.stream>) {
  store.stream = { ...store.stream, ...next };
  store.notify();
}

vi.mock("@/hooks/use-chat-stream", () => ({
  useChatStream: () => {
    const state = useSyncExternalStore(store.subscribe, () => store.stream);
    return { state, start: store.startMock, stop: store.stopMock, reset: store.resetMock };
  },
}));

vi.mock("@/trpc/react", () => ({
  api: {
    chat: {
      list: {
        useQuery: () => {
          const data = useSyncExternalStore(store.subscribe, () => store.conversationsList);
          return { data, isPending: false };
        },
      },
      get: {
        useQuery: (_input: { conversationId: string }, opts?: { enabled?: boolean }) => {
          const t = useSyncExternalStore(store.subscribe, () => store.thread);
          if (opts?.enabled === false) return { data: undefined, isLoading: false };
          return { data: t.data, isLoading: t.isLoading };
        },
      },
      create: { useMutation: () => ({ mutateAsync: store.createMutateAsync, isPending: false }) },
      rename: {
        useMutation: (opts?: { onSuccess?: (d: unknown, v: unknown) => void }) => ({
          mutate: (vars: unknown) => {
            store.renameMock(vars);
            opts?.onSuccess?.(undefined, vars);
          },
        }),
      },
      delete: {
        useMutation: (opts?: { onSuccess?: (d: unknown, v: unknown) => void }) => ({
          mutate: (vars: unknown) => {
            store.deleteMock(vars);
            opts?.onSuccess?.(undefined, vars);
          },
        }),
      },
      archive: {
        useMutation: (opts?: { onSuccess?: (d: unknown, v: unknown) => void }) => ({
          mutate: (vars: unknown) => {
            store.archiveMock(vars);
            opts?.onSuccess?.(undefined, vars);
          },
        }),
      },
    },
    useUtils: () => ({
      chat: {
        get: { invalidate: store.invalidateGetMock },
        list: { invalidate: store.invalidateListMock },
      },
    }),
  },
}));

let sp = new URLSearchParams("");
// `replace` aggiorna anche `sp` e ri-notifica gli iscritti (stesso store pattern sopra): serve ai
// test che devono osservare l'effetto di un `router.replace` su un successivo render (es. creare
// una conversazione e verificare che lo stream partito subito dopo non venga interrotto).
const replace = vi.fn((url: string) => {
  const q = url.includes("?") ? url.split("?")[1]! : "";
  sp = new URLSearchParams(q);
  store.notify();
});
vi.mock("next/navigation", () => ({
  useSearchParams: () => useSyncExternalStore(store.subscribe, () => sp),
  useRouter: () => ({ replace }),
  usePathname: () => "/assistente",
}));

import { AssistenteClient } from "./assistente-client";

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  sp = new URLSearchParams("");
  store.thread = { data: undefined, isLoading: false };
  store.conversationsList = [];
  store.stream = {
    status: "idle",
    text: "",
    tool: null,
    error: null,
    products: [],
    messageId: null,
  };
});

describe("AssistenteClient — persistenza ?c=", () => {
  it("montare con ?c=x carica quella conversazione", () => {
    sp = new URLSearchParams("c=conv1");
    setThread({
      conversation: { id: "conv1", title: "Prima chat" },
      messages: [
        {
          id: "m1",
          role: "USER",
          content: "Ciao",
          status: "SENT",
          errorMessage: null,
          products: [],
        },
      ],
    });
    render(<AssistenteClient />);
    expect(screen.getByText("Ciao")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Prima chat" })).toBeTruthy();
  });

  it("selezionare un'altra conversazione aggiorna l'URL (?c=)", () => {
    sp = new URLSearchParams("c=conv1");
    setThread({ conversation: { id: "conv1", title: "Prima chat" }, messages: [] });
    store.conversationsList = [
      { id: "conv1", title: "Prima chat", updatedAt: new Date() },
      { id: "conv2", title: "Seconda chat", updatedAt: new Date() },
    ];
    render(<AssistenteClient />);
    fireEvent.click(screen.getByText("Seconda chat"));
    expect(replace).toHaveBeenCalledWith("/assistente?c=conv2", { scroll: false });
  });
});

describe("AssistenteClient — handover bolla live → riga persistita", () => {
  it("durante lo streaming mostra la bolla live; a done+refetch la sostituisce senza duplicati", async () => {
    sp = new URLSearchParams("c=conv1");
    setThread({ conversation: { id: "conv1", title: "Nuova conversazione" }, messages: [] });
    render(<AssistenteClient />);

    fireEvent.change(screen.getByLabelText("Messaggio per l'assistente"), {
      target: { value: "Cerca cerniere" },
    });
    fireEvent.keyDown(screen.getByLabelText("Messaggio per l'assistente"), { key: "Enter" });
    // Il vero hook `useChatStream.start()` porta lo stato a "streaming" in modo sincrono, prima di
    // qualunque await: il mock replica qui quello stesso primo aggiornamento.
    act(() => setStream({ status: "streaming", text: "" }));
    await flush();

    // Bolla utente ottimistica visibile subito (prima ancora di qualunque evento SSE).
    expect(screen.getByText("Cerca cerniere")).toBeTruthy();
    expect(store.startMock).toHaveBeenCalledWith({
      conversationId: "conv1",
      content: "Cerca cerniere",
      mode: "send",
    });

    // Delta in arrivo: la bolla assistant live mostra il testo parziale.
    act(() => setStream({ status: "streaming", text: "Ecco le " }));
    expect(screen.getByText("Ecco le")).toBeTruthy();

    // `done`: testo finale + messageId, ma la cache di chat.get non è ancora aggiornata — la bolla
    // live deve restare (niente gap) e la riga persistita non deve ancora esserci.
    act(() => setStream({ status: "idle", text: "Ecco le cerniere.", messageId: "asst-1" }));
    expect(screen.getAllByText("Ecco le cerniere.")).toHaveLength(1);

    // Il refetch invalidato arriva: la cache ora contiene sia USER che ASSISTANT persistiti.
    act(() =>
      setThread({
        conversation: { id: "conv1", title: "Nuova conversazione" },
        messages: [
          {
            id: "u1",
            role: "USER",
            content: "Cerca cerniere",
            status: "SENT",
            errorMessage: null,
            products: [],
          },
          {
            id: "asst-1",
            role: "ASSISTANT",
            content: "Ecco le cerniere.",
            status: "SENT",
            errorMessage: null,
            products: [],
          },
        ],
      }),
    );

    // Un solo elemento col testo finale (la riga persistita) — la bolla live è stata rimpiazzata,
    // niente duplicato. La bolla utente ottimistica non compare più (rimpiazzata dal messaggio USER
    // persistito, comparso una sola volta).
    expect(screen.getAllByText("Ecco le cerniere.")).toHaveLength(1);
    expect(screen.getAllByText("Cerca cerniere")).toHaveLength(1);
  });

  it("creare la conversazione al primo invio non interrompe lo stream appena avviato", async () => {
    // Nessuna conversazione ancora nell'URL: il primo invio deve chiamare create(), scrivere
    // `?c=<nuovo-id>` e SUBITO DOPO avviare lo stream — la transizione null→id non deve far
    // scattare l'effetto di "cambio conversazione" (che altrimenti interromperebbe questo stream
    // appena partito, vedi `skipResetRef` in assistente-client.tsx).
    sp = new URLSearchParams("");
    render(<AssistenteClient />);

    fireEvent.change(screen.getByLabelText("Messaggio per l'assistente"), {
      target: { value: "Prima domanda" },
    });
    fireEvent.keyDown(screen.getByLabelText("Messaggio per l'assistente"), { key: "Enter" });
    await flush();

    expect(store.createMutateAsync).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/assistente?c=new-conv", { scroll: false });
    expect(store.startMock).toHaveBeenCalledWith({
      conversationId: "new-conv",
      content: "Prima domanda",
      mode: "send",
    });

    act(() => setStream({ status: "streaming", text: "Rispondo" }));
    await flush();

    // Lo stream NON è stato interrotto dalla transizione ?c= che ha appena scritto: la bolla utente
    // ottimistica e il testo parziale sono ancora entrambi visibili.
    expect(store.resetMock).not.toHaveBeenCalled();
    expect(screen.getByText("Prima domanda")).toBeTruthy();
    expect(screen.getByText("Rispondo")).toBeTruthy();
  });

  it("selezionare un'altra conversazione PRIMA che atterri la transizione dell'id appena creato interrompe lo stream orfano", async () => {
    // Corsa "scavalcamento" (vedi `skipResetForIdRef` in assistente-client.tsx): `handleSend` senza
    // conversazione aperta fa create() → imposta la guardia sull'id appena creato → scrive
    // `?c=new-conv` con `router.replace` (non sincrono). Se PRIMA che quella transizione atterri —
    // nessun render l'ha ancora "vista" — l'utente seleziona un'ALTRA conversazione, la SUA
    // `router.replace` vince e `conversationId` salta direttamente null→conv2, scavalcando
    // `new-conv`. Una guardia booleana "cieca" (il bug corretto in questa sessione) lascerebbe
    // questo salto senza reset: lo stream appena avviato per `new-conv` resterebbe orfano e il suo
    // contenuto live continuerebbe a comparire — ma sotto conv2. Controlliamo il momento esatto in
    // cui `create.mutateAsync()` si risolve per poter far scattare la seconda `router.replace`
    // (il click su "Seconda chat") PRIMA che React osservi mai `?c=new-conv` in un render.
    let resolveCreate!: (v: { id: string; title: string }) => void;
    store.createMutateAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );
    // Simula quello che fa il vero `useChatStream.reset()`: interrompe lo stream e torna a idle —
    // necessario per verificare anche la conseguenza sul rendering, non solo che `reset` sia stato
    // chiamato (il mock di `reset`, di suo, non tocca lo stato).
    store.resetMock.mockImplementation(() =>
      setStream({ status: "idle", text: "", messageId: null }),
    );

    sp = new URLSearchParams("");
    setThread({ conversation: { id: "conv2", title: "Seconda chat" }, messages: [] });
    store.conversationsList = [{ id: "conv2", title: "Seconda chat", updatedAt: new Date() }];
    render(<AssistenteClient />);

    fireEvent.change(screen.getByLabelText("Messaggio per l'assistente"), {
      target: { value: "Prima domanda" },
    });
    fireEvent.keyDown(screen.getByLabelText("Messaggio per l'assistente"), { key: "Enter" });

    await act(async () => {
      resolveCreate({ id: "new-conv", title: "Nuova conversazione" });
      // Un solo giro di microtask basta perché la continuazione di `handleSend` (che attende
      // direttamente questa promise) arrivi fino a `router.replace('...?c=new-conv')` incluso —
      // resta comunque tutto dentro questo stesso `act()`, quindi nessun render intermedio scatta.
      await Promise.resolve();
      // Lo stream appena avviato produce già testo live...
      setStream({ status: "streaming", text: "Testo orfano" });
      // ...e PRIMA che la transizione ?c=new-conv atterri, l'utente seleziona un'altra
      // conversazione: la sua `replace` vince.
      fireEvent.click(screen.getByText("Seconda chat"));
    });
    await flush();

    // Conferma che la corsa si è verificata come previsto: la prima `replace` (verso l'id appena
    // creato) è stata scavalcata dalla seconda (verso conv2) prima che un render la osservasse.
    expect(replace).toHaveBeenNthCalledWith(1, "/assistente?c=new-conv", { scroll: false });
    expect(replace).toHaveBeenNthCalledWith(2, "/assistente?c=conv2", { scroll: false });

    // Lo stream orfano è stato interrotto — non lasciato a mutare lo stato sotto la conversazione
    // appena selezionata.
    expect(store.resetMock).toHaveBeenCalled();
    expect(screen.queryByText("Testo orfano")).toBeNull();
  });
});

describe("AssistenteClient — STOP mantiene visibile la risposta parziale", () => {
  /** Invia un messaggio e porta lo stream a "streaming" con del testo già ricevuto. */
  async function sendAndStream(text: string) {
    fireEvent.change(screen.getByLabelText("Messaggio per l'assistente"), {
      target: { value: "Cerca cerniere" },
    });
    fireEvent.keyDown(screen.getByLabelText("Messaggio per l'assistente"), { key: "Enter" });
    act(() => setStream({ status: "streaming", text: "" }));
    await flush();
    act(() => setStream({ status: "streaming", text }));
  }

  it("dopo lo STOP il parziale resta a schermo finché la riga persistita non arriva", async () => {
    sp = new URLSearchParams("c=conv1");
    setThread({ conversation: { id: "conv1", title: "Chat" }, messages: [] });
    render(<AssistenteClient />);
    await sendAndStream("Ecco le cerniere par");

    // STOP: il vero hook torna a `idle` mantenendo il testo accumulato, MA senza `messageId`
    // (nessun evento `done` è arrivato: la fetch è stata abortita).
    fireEvent.click(screen.getByRole("button", { name: "Interrompi" }));
    act(() => setStream({ status: "idle", text: "Ecco le cerniere par", messageId: null }));
    expect(store.stopMock).toHaveBeenCalled();

    // Il refetch atterra PRIMA che il server abbia scritto il parziale: c'è solo la riga USER.
    // È esattamente la corsa che faceva sparire il testo dallo schermo.
    act(() =>
      setThread({
        conversation: { id: "conv1", title: "Chat" },
        messages: [
          { id: "u1", role: "USER", content: "Cerca cerniere", status: "SENT", errorMessage: null, products: [] },
        ],
      }),
    );
    expect(screen.getByText("Ecco le cerniere par")).toBeTruthy();
    // …e senza doppiare il messaggio utente (bolla ottimistica + riga persistita).
    expect(screen.getAllByText("Cerca cerniere")).toHaveLength(1);

    // Arriva la scrittura del server: la riga persistita prende il posto della bolla live.
    act(() =>
      setThread({
        conversation: { id: "conv1", title: "Chat" },
        messages: [
          { id: "u1", role: "USER", content: "Cerca cerniere", status: "SENT", errorMessage: null, products: [] },
          {
            id: "a1",
            role: "ASSISTANT",
            content: "Ecco le cerniere par",
            status: "SENT",
            errorMessage: null,
            products: [],
          },
        ],
      }),
    );
    expect(screen.getAllByText("Ecco le cerniere par")).toHaveLength(1);
    expect(screen.getAllByText("Cerca cerniere")).toHaveLength(1);
  });

  it("STOP prima del primo token non lascia montato un turno vuoto", async () => {
    // Senza testo il server non persiste nulla: non c'è nessuna riga da attendere, quindi il turno
    // live deve smontarsi subito (altrimenti resterebbe una bolla assistant vuota per sempre).
    sp = new URLSearchParams("c=conv1");
    setThread({ conversation: { id: "conv1", title: "Chat" }, messages: [] });
    render(<AssistenteClient />);
    await sendAndStream("");

    fireEvent.click(screen.getByRole("button", { name: "Interrompi" }));
    act(() => setStream({ status: "idle", text: "", messageId: null }));
    act(() =>
      setThread({
        conversation: { id: "conv1", title: "Chat" },
        messages: [
          { id: "u1", role: "USER", content: "Cerca cerniere", status: "SENT", errorMessage: null, products: [] },
        ],
      }),
    );

    expect(screen.getAllByText("Cerca cerniere")).toHaveLength(1);
    expect(document.querySelectorAll('[data-role="ASSISTANT"]')).toHaveLength(0);
  });
});

describe("AssistenteClient — banner d'errore", () => {
  it("non mostra due volte il messaggio utente quando la riga persistita è già in cache", async () => {
    sp = new URLSearchParams("c=conv1");
    setThread({ conversation: { id: "conv1", title: "Chat" }, messages: [] });
    render(<AssistenteClient />);

    fireEvent.change(screen.getByLabelText("Messaggio per l'assistente"), {
      target: { value: "Cerca cerniere" },
    });
    fireEvent.keyDown(screen.getByLabelText("Messaggio per l'assistente"), { key: "Enter" });
    act(() => setStream({ status: "streaming", text: "" }));
    await flush();

    // Il turno fallisce (errore NON recuperabile: nessun auto-retry) e il refetch porta la riga
    // USER che la route aveva già persistito prima di iniziare lo stream.
    act(() =>
      setStream({
        status: "error",
        error: { recoverable: false, message: "Errore imprevisto" },
      }),
    );
    act(() =>
      setThread({
        conversation: { id: "conv1", title: "Chat" },
        messages: [
          { id: "u1", role: "USER", content: "Cerca cerniere", status: "SENT", errorMessage: null, products: [] },
        ],
      }),
    );

    expect(screen.getByRole("alert").textContent).toContain("Errore imprevisto");
    expect(screen.getAllByText("Cerca cerniere")).toHaveLength(1);
  });
});

describe("AssistenteClient — elimina/archivia la conversazione attiva", () => {
  it("eliminare la conversazione attiva azzera ?c=", () => {
    sp = new URLSearchParams("c=conv1");
    setThread({ conversation: { id: "conv1", title: "Prima chat" }, messages: [] });
    store.conversationsList = [{ id: "conv1", title: "Prima chat", updatedAt: new Date() }];
    render(<AssistenteClient />);

    fireEvent.click(screen.getByLabelText("Azioni per Prima chat"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Elimina" }));
    fireEvent.click(screen.getByRole("button", { name: "Elimina" }));

    expect(store.deleteMock).toHaveBeenCalledWith({ conversationId: "conv1" });
    expect(replace).toHaveBeenCalledWith("/assistente", { scroll: false });
  });

  it("archiviare la conversazione attiva azzera ?c=", () => {
    sp = new URLSearchParams("c=conv1");
    setThread({ conversation: { id: "conv1", title: "Prima chat" }, messages: [] });
    store.conversationsList = [{ id: "conv1", title: "Prima chat", updatedAt: new Date() }];
    render(<AssistenteClient />);

    fireEvent.click(screen.getByLabelText("Azioni per Prima chat"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Archivia" }));

    expect(store.archiveMock).toHaveBeenCalledWith({ conversationId: "conv1" });
    expect(replace).toHaveBeenCalledWith("/assistente", { scroll: false });
  });

  it("eliminare una conversazione NON attiva non tocca l'URL", () => {
    sp = new URLSearchParams("c=conv1");
    setThread({ conversation: { id: "conv1", title: "Prima chat" }, messages: [] });
    store.conversationsList = [
      { id: "conv1", title: "Prima chat", updatedAt: new Date() },
      { id: "conv2", title: "Seconda chat", updatedAt: new Date() },
    ];
    render(<AssistenteClient />);

    fireEvent.click(screen.getByLabelText("Azioni per Seconda chat"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Elimina" }));
    const rows = screen.getAllByRole("listitem");
    const row = rows.find((r) => within(r).queryByText(/Eliminare/));
    fireEvent.click(within(row!).getByRole("button", { name: "Elimina" }));

    expect(store.deleteMock).toHaveBeenCalledWith({ conversationId: "conv2" });
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("AssistenteClient — auto-retry su errore recuperabile", () => {
  it("ritenta al massimo due volte, poi si ferma (resta solo il manuale)", () => {
    vi.useFakeTimers();
    sp = new URLSearchParams("c=conv1");
    setThread({ conversation: { id: "conv1", title: "Chat" }, messages: [] });
    render(<AssistenteClient />);

    act(() =>
      setStream({
        status: "error",
        error: { recoverable: true, retryAfter: 1, message: "Troppe richieste." },
      }),
    );
    expect(screen.getByRole("alert").textContent).toContain("Troppe richieste.");
    expect(store.startMock).toHaveBeenCalledTimes(0);

    act(() => vi.advanceTimersByTime(1000));
    expect(store.startMock).toHaveBeenCalledTimes(1);
    expect(store.startMock).toHaveBeenLastCalledWith({
      conversationId: "conv1",
      mode: "regenerate",
    });

    act(() =>
      setStream({
        status: "error",
        error: { recoverable: true, retryAfter: 1, message: "Ancora occupato." },
      }),
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(store.startMock).toHaveBeenCalledTimes(2);

    // Terzo errore consecutivo: il tetto di 2 auto-retry è raggiunto, nessun altro timer parte.
    act(() =>
      setStream({
        status: "error",
        error: { recoverable: true, retryAfter: 1, message: "Di nuovo." },
      }),
    );
    act(() => vi.advanceTimersByTime(5000));
    expect(store.startMock).toHaveBeenCalledTimes(2);

    // Il bottone manuale resta disponibile e funziona.
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(store.startMock).toHaveBeenCalledTimes(3);
  });
});
