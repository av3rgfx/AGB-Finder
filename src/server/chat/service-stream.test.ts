import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimitedError } from "@/server/ai/errors";
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
        isAvailable: true,
        stockQuantity: 3,
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
        isAvailable: true,
        stockQuantity: 3,
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
    chatStream.mockImplementationOnce(async function* () {
      yield { type: "text-delta", text: "Ciao" } as ProviderChunk;
      throw new DOMException("Aborted", "AbortError");
    });
    const controller = new AbortController();
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
  it("persiste ASSISTANT status ERROR ed emette un evento error non recuperabile", async () => {
    const { gateway, chatStream } = streamGateway();
    chatStream.mockImplementationOnce(async function* () {
      throw new Error("Provider giù");
    });
    const svc = new ChatService(db, gateway);

    const out = await drain(svc);

    expect(out).toEqual([{ type: "error", recoverable: false, message: "Provider giù" }]);
    expect(assistantData()).toMatchObject({
      status: "ERROR",
      errorMessage: "Provider giù",
      content: "",
    });
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
  it("elimina l'ultimo messaggio ASSISTANT per createdAt", async () => {
    messageFindFirst.mockResolvedValueOnce({ id: "m9" });
    const svc = new ChatService(db, {} as unknown as AIGateway);
    await svc.deleteLastAssistant("conv1");
    expect(messageFindFirst).toHaveBeenCalledWith({
      where: { conversationId: "conv1", role: "ASSISTANT" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    expect(messageDelete).toHaveBeenCalledWith({ where: { id: "m9" } });
  });

  it("nessun ASSISTANT presente → non chiama delete", async () => {
    messageFindFirst.mockResolvedValueOnce(null);
    const svc = new ChatService(db, {} as unknown as AIGateway);
    await svc.deleteLastAssistant("conv1");
    expect(messageDelete).not.toHaveBeenCalled();
  });
});

describe("SYSTEM_PROMPT", () => {
  it("abilita il markdown conciso (non più 'senza markdown')", () => {
    expect(SYSTEM_PROMPT).toContain("Formatta con markdown conciso");
    expect(SYSTEM_PROMPT).not.toContain("senza markdown");
  });
});
