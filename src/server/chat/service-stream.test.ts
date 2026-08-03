import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProviderHttpError, RateLimitedError } from "@/server/ai/errors";
import type { AIGateway } from "@/server/ai/gateway";
import type { ProviderChunk } from "@/server/ai/providers/types";
import type { ChatEvent } from "./events";
import { CHAT_PRODUCT_SELECT } from "./products";
import { ChatService, SYSTEM_PROMPT, type ChatDb } from "./service";
import { executeTool, TOOL_DECLARATIONS } from "./tools";

// executeTool va mockato (il tool-loop non deve toccare RAGEngine/Prisma reali); TOOL_DECLARATIONS
// resta quello vero così le asserzioni sui parametri passati a chatStream restano significative.
vi.mock("./tools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./tools")>();
  return { ...actual, executeTool: vi.fn() };
});

const executeToolMock = vi.mocked(executeTool);

const messageCreate = vi.fn();
const messageFindMany = vi.fn();
const messageFindFirst = vi.fn();
const messageDelete = vi.fn();
const conversationUpdate = vi.fn();
const productFindMany = vi.fn();

const db = {
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  product: { findMany: productFindMany, findUnique: vi.fn() },
  message: {
    create: messageCreate,
    findMany: messageFindMany,
    findFirst: messageFindFirst,
    delete: messageDelete,
  },
  conversation: { update: conversationUpdate },
} as unknown as ChatDb;

let createCounter = 0;

/** Fake gateway: chatStream scriptabile un round alla volta via mockImplementationOnce. */
function streamGateway() {
  const chatStream = vi.fn();
  const gateway = { queryEmbeddings: () => undefined, chatStream } as unknown as AIGateway;
  return { gateway, chatStream };
}

function round(chunks: ProviderChunk[]) {
  return async function* () {
    for (const chunk of chunks) yield chunk;
  };
}

async function drain(svc: ChatService, signal: AbortSignal = AbortSignal.timeout(2000)) {
  const out: ChatEvent[] = [];
  for await (const e of svc.generateStream("conv1", "agent1", signal)) out.push(e);
  return out;
}

function assistantData() {
  return messageCreate.mock.calls.find((c) => c[0].data.role === "ASSISTANT")?.[0].data;
}

/**
 * Emula `message.findFirst({ where: { role: { in: [...] } }, orderBy: { createdAt: "desc" } })`
 * su un insieme di righe in ordine di creazione, invece di restituire un valore pre-cotto: così i
 * test di `deleteLastAssistant` esercitano davvero la query (compreso QUALI ruoli chiede) e non
 * restano verdi per costruzione se la query cambia.
 */
function seedRows(rows: { id: string; role: string }[]) {
  messageFindFirst.mockImplementation(
    ({ where }: { where: { role: { in: string[] } | string } }) => {
      const roles = typeof where.role === "string" ? [where.role] : where.role.in;
      const match = [...rows].reverse().find((r) => roles.includes(r.role));
      return Promise.resolve(match ? { id: match.id, role: match.role } : null);
    },
  );
  // `delete` rimuove davvero la riga da `rows`: i test di regressione possono così asserire che
  // la risposta buona è ANCORA lì, non solo che `delete` non è stato chiamato.
  messageDelete.mockImplementation(({ where }: { where: { id: string } }) => {
    const i = rows.findIndex((r) => r.id === where.id);
    if (i >= 0) rows.splice(i, 1);
    return Promise.resolve({});
  });
  return rows;
}

beforeEach(() => {
  createCounter = 0;
  messageCreate.mockReset();
  messageCreate.mockImplementation(({ data }: { data: { role: string } }) => {
    createCounter += 1;
    return Promise.resolve({ id: `m${createCounter}_${data.role}`, ...data });
  });
  messageFindMany.mockReset();
  messageFindMany.mockResolvedValue([]);
  messageFindFirst.mockReset();
  messageDelete.mockReset();
  conversationUpdate.mockReset();
  conversationUpdate.mockResolvedValue({});
  productFindMany.mockReset();
  productFindMany.mockResolvedValue([]);
  executeToolMock.mockReset();
});

describe("generateStream — un round tool poi risposta finale", () => {
  it("emette tool start/end + delta, persiste TOOL e ASSISTANT, risolve i prodotti citati", async () => {
    const { gateway, chatStream } = streamGateway();
    chatStream
      .mockImplementationOnce(
        round([{ type: "tool-call", call: { id: "c0", name: "search_products", arguments: { query: "x" } } }]),
      )
      .mockImplementationOnce(
        round([
          { type: "text-delta", text: "Ecco " },
          { type: "text-delta", text: "A50107.03" },
          { type: "usage", tokens: 10 },
        ]),
      );
    executeToolMock.mockResolvedValueOnce({ output: { total: 1 }, productIds: ["p1"] });
    productFindMany.mockResolvedValueOnce([
      {
        id: "p1",
        agbCode: "A50107.03",
        name: "Cerniera",
        shortDescription: null,
        basePrice: 12.5,
        priceUnit: "EUR",
        listinoPage: 42,
      },
    ]);

    const svc = new ChatService(db, gateway);
    const out = await drain(svc);

    expect(out.filter((e) => e.type === "tool")).toHaveLength(2);
    expect(out.filter((e) => e.type === "tool").map((e) => (e as { phase: string }).phase)).toEqual([
      "start",
      "end",
    ]);
    expect(out.filter((e) => e.type === "delta").map((e) => (e as { text: string }).text).join("")).toBe(
      "Ecco A50107.03",
    );

    const done = out.at(-1) as Extract<ChatEvent, { type: "done" }>;
    expect(done.type).toBe("done");
    expect(done.messageId).toBeTruthy();
    expect(done.tokens).toBe(10);
    expect(done.products).toEqual([
      {
        id: "p1",
        agbCode: "A50107.03",
        name: "Cerniera",
        shortDescription: null,
        basePrice: 12.5,
        priceUnit: "EUR",
        listinoPage: 42,
      },
    ]);
    expect(productFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1"] } },
      select: CHAT_PRODUCT_SELECT,
    });

    const toolMessage = messageCreate.mock.calls.find((c) => c[0].data.role === "TOOL")![0].data;
    expect(toolMessage).toMatchObject({
      toolName: "search_products",
      toolInput: { query: "x" },
      toolOutput: { total: 1 },
    });

    const assistant = assistantData();
    expect(assistant).toMatchObject({
      content: "Ecco A50107.03",
      status: "SENT",
      errorMessage: null,
      modelUsed: null,
      tokensUsed: 10,
      referencedProductIds: ["p1"],
    });
    expect(assistant.latencyMs).toBeGreaterThanOrEqual(0);
    expect(done.messageId).toBe("m2_ASSISTANT"); // 1° create = TOOL, 2° create = ASSISTANT

    expect(conversationUpdate).toHaveBeenCalledWith({
      where: { id: "conv1" },
      data: { updatedAt: expect.any(Date) },
    });

    // il secondo round (ancora sotto il cap) riceve i tool + il risultato del tool nel transcript
    expect(chatStream).toHaveBeenCalledTimes(2);
    expect(chatStream.mock.calls[1]![1]).toEqual(TOOL_DECLARATIONS);
    const secondTranscript = chatStream.mock.calls[1]![0] as unknown[];
    expect(secondTranscript.at(-1)).toMatchObject({ role: "tool", toolName: "search_products" });
  });
});

describe("generateStream — STOP", () => {
  it("abort dopo del testo → persiste il parziale come SENT ed emette 'done', nessun secondo round", async () => {
    const { gateway, chatStream } = streamGateway();
    const controller = new AbortController();
    chatStream.mockImplementationOnce(async function* () {
      yield { type: "text-delta", text: "Ciao" } as ProviderChunk;
      // STOP dell'utente: prima il signal viene abortito, POI l'abort risale dal fetch come
      // eccezione. L'ordine conta — è da `signal.aborted` che il service distingue uno stop
      // voluto da un guasto del provider.
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    });
    const svc = new ChatService(db, gateway);

    const out = await drain(svc, controller.signal);

    expect(out.filter((e) => e.type === "delta").map((e) => (e as { text: string }).text).join("")).toBe(
      "Ciao",
    );
    const done = out.at(-1) as Extract<ChatEvent, { type: "done" }>;
    expect(done.type).toBe("done");
    expect(assistantData()).toMatchObject({ content: "Ciao", status: "SENT" });
    expect(chatStream).toHaveBeenCalledTimes(1);
  });

  it("abort PRIMA del primo token → nessuna riga ASSISTANT fantasma in stato ERROR", async () => {
    // L'abort NON esce sempre in modo pulito tra un round e l'altro: se l'utente preme STOP mentre
    // il fetch al provider è aperto, risale come eccezione (AbortError) dentro il catch. Va trattato
    // come lo stop pulito — altrimenti resta nel thread, per sempre, una risposta vuota in errore.
    const { gateway, chatStream } = streamGateway();
    const controller = new AbortController();
    chatStream.mockImplementationOnce(async function* () {
      controller.abort();
      throw new DOMException("This operation was aborted.", "AbortError");
    });
    const svc = new ChatService(db, gateway);

    const out = await drain(svc, controller.signal);

    expect(out).toEqual([]);
    expect(messageCreate).not.toHaveBeenCalled();
    expect(conversationUpdate).not.toHaveBeenCalled();
  });

  it("abort tra due round tool (nessun testo ancora) → si ferma, nessuna riga ASSISTANT né evento terminale", async () => {
    const { gateway, chatStream } = streamGateway();
    const controller = new AbortController();
    chatStream.mockImplementationOnce(
      round([{ type: "tool-call", call: { id: "c0", name: "search_products", arguments: { query: "x" } } }]),
    );
    executeToolMock.mockImplementationOnce(async () => {
      controller.abort(); // l'utente preme STOP mentre il tool è in corso
      return { output: { total: 0 }, productIds: [] };
    });

    const svc = new ChatService(db, gateway);
    const out = await drain(svc, controller.signal);

    expect(chatStream).toHaveBeenCalledTimes(1); // il secondo round non parte
    expect(out.filter((e) => e.type === "done" || e.type === "error")).toHaveLength(0);
    expect(assistantData()).toBeUndefined();
  });
});

describe("generateStream — rate limit pre-primo-token", () => {
  it("nessun testo ancora ricevuto → evento error recoverable, nessuna riga ASSISTANT persistita", async () => {
    const { gateway, chatStream } = streamGateway();
    chatStream.mockImplementationOnce(async function* () {
      throw new RateLimitedError();
    });
    const svc = new ChatService(db, gateway);

    const out = await drain(svc);

    expect(out).toEqual([
      { type: "error", recoverable: true, retryAfter: 20, message: "Assistente momentaneamente occupato" },
    ]);
    expect(messageCreate).not.toHaveBeenCalled();
    expect(conversationUpdate).not.toHaveBeenCalled();
  });
});

describe("generateStream — errore non recuperabile senza testo", () => {
  it("persiste ASSISTANT status ERROR con copia UTENTE in italiano, senza il messaggio grezzo del provider", async () => {
    const { gateway, chatStream } = streamGateway();
    // Errore realistico del provider: messaggio in inglese con dettagli interni. Non deve mai
    // arrivare alla UI (italiana) né finire in colonna `errorMessage`, ma resta nei log.
    const raw = new ProviderHttpError("gemini", 429);
    chatStream.mockImplementationOnce(async function* () {
      throw raw;
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const svc = new ChatService(db, gateway);

    const out = await drain(svc);

    expect(out).toEqual([{ type: "error", recoverable: false, message: "Errore imprevisto" }]);
    expect(assistantData()).toMatchObject({
      status: "ERROR",
      errorMessage: "Errore imprevisto",
      content: "",
    });
    expect(JSON.stringify(out)).not.toContain("gemini: HTTP 429");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("turno fallito"), raw);
    warn.mockRestore();
  });
});

describe("generateStream — cap a 3 round tool", () => {
  it("al 4° giro forza la risposta finale senza tool", async () => {
    const { gateway, chatStream } = streamGateway();
    for (let i = 0; i < 3; i++) {
      chatStream.mockImplementationOnce(
        round([
          {
            type: "tool-call",
            call: { id: `c${i}`, name: "get_product_by_code", arguments: { agbCode: "B1" } },
          },
        ]),
      );
    }
    chatStream.mockImplementationOnce(round([{ type: "text-delta", text: "basta tool" }]));
    executeToolMock.mockResolvedValue({ output: { error: "n/a" }, productIds: [] });

    const svc = new ChatService(db, gateway);
    const out = await drain(svc);

    expect(chatStream).toHaveBeenCalledTimes(4); // 3 round con tool + 1 forzato senza
    expect(chatStream.mock.calls[0]![1]).toEqual(TOOL_DECLARATIONS);
    expect(chatStream.mock.calls[3]![1]).toEqual([]); // ultimo giro: niente tool

    const done = out.at(-1) as Extract<ChatEvent, { type: "done" }>;
    expect(done.type).toBe("done");
    expect(assistantData()).toMatchObject({ content: "basta tool", status: "SENT" });
    expect(messageCreate.mock.calls.filter((c) => c[0].data.role === "TOOL")).toHaveLength(3);
  });
});

describe("ChatService.persistUserMessage", () => {
  it("crea un messaggio USER", async () => {
    const svc = new ChatService(db, {} as unknown as AIGateway);
    await svc.persistUserMessage("conv1", "Ciao");
    expect(messageCreate).toHaveBeenCalledWith({
      data: { conversationId: "conv1", role: "USER", content: "Ciao" },
    });
  });
});

describe("ChatService.deleteLastAssistant", () => {
  it("l'id atteso è l'ultima riga della conversazione → la elimina", async () => {
    seedRows([
      { id: "u1", role: "USER" },
      { id: "a1", role: "ASSISTANT" },
    ]);
    const svc = new ChatService(db, {} as unknown as AIGateway);
    await svc.deleteLastAssistant("conv1", "a1");
    expect(messageFindFirst).toHaveBeenCalledWith({
      where: { conversationId: "conv1", role: { in: ["USER", "ASSISTANT"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, role: true },
    });
    expect(messageDelete).toHaveBeenCalledWith({ where: { id: "a1" } });
  });

  it("conversazione vuota → non chiama delete", async () => {
    seedRows([]);
    const svc = new ChatService(db, {} as unknown as AIGateway);
    await svc.deleteLastAssistant("conv1", "a1");
    expect(messageDelete).not.toHaveBeenCalled();
  });

  it("REGRESSIONE: senza id atteso non cancella NULLA, nemmeno se in coda c'è una risposta", async () => {
    // Forma «offline»: la richiesta non ha mai raggiunto il server, quindi in coda c'è ancora la
    // risposta BUONA del turno precedente. Un retry che non dichiara quale risposta intende
    // rigenerare non deve poter distruggere quella riga: senza id non si cancella, mai a indovinare.
    const rows = seedRows([
      { id: "u1", role: "USER" },
      { id: "a1", role: "ASSISTANT" },
    ]);
    const svc = new ChatService(db, {} as unknown as AIGateway);
    await svc.deleteLastAssistant("conv1", undefined);
    expect(messageDelete).not.toHaveBeenCalled();
    expect(rows.map((r) => r.id)).toContain("a1");
  });

  it("REGRESSIONE: id che NON coincide con la coda → non cancella nulla", async () => {
    // Il client crede di rigenerare `a0` (una risposta più vecchia, o già sostituita da un altro
    // dispositivo): la coda è un'ALTRA risposta. Mai «cancello comunque l'ultima»: nessun delete.
    const rows = seedRows([
      { id: "u1", role: "USER" },
      { id: "a1", role: "ASSISTANT" },
    ]);
    const svc = new ChatService(db, {} as unknown as AIGateway);
    await svc.deleteLastAssistant("conv1", "a0");
    expect(messageDelete).not.toHaveBeenCalled();
    expect(rows.map((r) => r.id)).toContain("a1");
  });

  it("REGRESSIONE: l'ultima riga è un USER (turno fallito) → NON tocca la risposta precedente", async () => {
    // Il turno corrente è fallito prima di produrre qualunque risposta (nessuna riga ASSISTANT in
    // coda): non c'è NIENTE da rigenerare. La risposta ASSISTANT più recente appartiene al turno
    // PRECEDENTE ed è un dato buono dell'utente — cancellarla sarebbe perdita di dati.
    const rows = seedRows([
      { id: "u1", role: "USER" },
      { id: "a1", role: "ASSISTANT" },
      { id: "u2", role: "USER" },
    ]);
    const svc = new ChatService(db, {} as unknown as AIGateway);
    await svc.deleteLastAssistant("conv1", "a1");
    expect(messageDelete).not.toHaveBeenCalled();
    expect(rows.map((r) => r.id)).toContain("a1");
  });

  it("le righe TOOL intermedie non contano come 'ultima riga'", async () => {
    // Un round tool scrive righe TOOL dopo l'ASSISTANT del turno precedente: devono restare
    // trasparenti sia in un senso sia nell'altro (qui la coda è un USER → nessun delete).
    seedRows([
      { id: "a1", role: "ASSISTANT" },
      { id: "u2", role: "USER" },
      { id: "t1", role: "TOOL" },
    ]);
    const svc = new ChatService(db, {} as unknown as AIGateway);
    await svc.deleteLastAssistant("conv1", "a1");
    expect(messageDelete).not.toHaveBeenCalled();
  });
});

describe("REGRESSIONE — rate limit + auto-retry del client non distrugge il turno precedente", () => {
  it("il round fallisce per rate limit e il «regenerate» automatico lascia intatta la risposta buona", async () => {
    // Sequenza reale: la conversazione ha già una risposta buona (a1); l'utente invia un nuovo
    // messaggio (u2); il round va in rate limit PRIMA del primo token, quindi generateStream non
    // persiste nulla; il client ritenta automaticamente in `mode: "regenerate"`, che sulla route
    // chiama `deleteLastAssistant`. Quella delete non deve toccare a1.
    const rows = [
      { id: "u1", role: "USER" },
      { id: "a1", role: "ASSISTANT" },
      { id: "u2", role: "USER" },
    ];
    seedRows(rows);
    const { gateway, chatStream } = streamGateway();
    chatStream.mockImplementationOnce(async function* () {
      throw new RateLimitedError();
    });
    const svc = new ChatService(db, gateway);

    const out = await drain(svc);
    expect(out).toEqual([
      { type: "error", recoverable: true, retryAfter: 20, message: "Assistente momentaneamente occupato" },
    ]);
    expect(messageCreate).not.toHaveBeenCalled(); // il turno fallito non lascia righe

    // …e ora l'auto-retry del client (assistente-client.tsx, effetto di auto-retry): rigenera
    // «il turno fallito», che non ha prodotto nessuna risposta — quindi senza id atteso.
    await svc.deleteLastAssistant("conv1", undefined);

    expect(messageDelete).not.toHaveBeenCalled();
    expect(rows.map((r) => r.id)).toContain("a1");
  });
});

describe("SYSTEM_PROMPT", () => {
  it("abilita il markdown conciso (non più 'senza markdown')", () => {
    expect(SYSTEM_PROMPT).toContain("Formatta con markdown conciso");
    expect(SYSTEM_PROMPT).not.toContain("senza markdown");
  });
});
