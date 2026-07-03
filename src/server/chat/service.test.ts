import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimitedError } from "@/server/ai/errors";
import type { ChatResult } from "@/server/ai/providers/types";
import { ChatService, SYSTEM_PROMPT, type ChatDb } from "./service";

const messageCreate = vi.fn();
const messageFindMany = vi.fn();
const messageDeleteMany = vi.fn();
const queryRaw = vi.fn();
const findUnique = vi.fn();

const db = {
  $queryRaw: queryRaw,
  $executeRaw: vi.fn(),
  product: { findUnique },
  message: { create: messageCreate, findMany: messageFindMany, deleteMany: messageDeleteMany },
} as unknown as ChatDb;

const chat = vi.fn();
const gateway = { chat, queryEmbeddings: () => undefined } as never;

function textResult(text: string): ChatResult {
  return { text, toolCalls: [], modelUsed: "gemini-2.5-flash", tokensUsed: 10 };
}

const hit = {
  id: "p1",
  agbCode: "E10073.10.16",
  name: "COMPACT DX",
  shortDescription: null,
  basePrice: 51.59,
  priceUnit: "EUR",
  isAvailable: true,
  stockQuantity: 0,
  categoryId: "c1",
  categoryName: "Cerniere",
  textScore: 1,
  vectorScore: 0,
  score: 1,
};

beforeEach(() => {
  messageCreate.mockReset();
  messageCreate.mockImplementation(({ data }: { data: { role: string } }) =>
    Promise.resolve({ id: "m_" + data.role, ...data }),
  );
  messageFindMany.mockReset();
  messageFindMany.mockResolvedValue([]);
  messageDeleteMany.mockReset();
  messageDeleteMany.mockResolvedValue({ count: 0 });
  queryRaw.mockReset();
  findUnique.mockReset();
  chat.mockReset();
});

describe("ChatService.send — risposta diretta", () => {
  it("persiste USER prima della chiamata AI, poi ASSISTANT con metadati", async () => {
    chat.mockResolvedValueOnce(textResult("Ciao!"));
    const service = new ChatService(db, gateway);
    const result = await service.send({ conversationId: "c1", agentId: "a1", content: "Ciao" });

    expect(messageCreate.mock.calls[0]![0].data).toMatchObject({
      conversationId: "c1",
      role: "USER",
      content: "Ciao",
    });
    const assistant = messageCreate.mock.calls[1]![0].data;
    expect(assistant).toMatchObject({
      role: "ASSISTANT",
      content: "Ciao!",
      modelUsed: "gemini-2.5-flash",
      tokensUsed: 10,
      referencedProductIds: [],
    });
    expect(assistant.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.assistantMessageId).toBe("m_ASSISTANT");
    // il transcript parte dal system prompt
    expect(chat.mock.calls[0]![0][0]).toEqual({ role: "system", content: SYSTEM_PROMPT });
  });
});

describe("ChatService.send — round tool", () => {
  it("esegue il tool, persiste il messaggio TOOL e propaga referencedProductIds", async () => {
    chat
      .mockResolvedValueOnce({
        text: null,
        toolCalls: [{ id: "call_0", name: "search_products", arguments: { query: "cerniera" } }],
        modelUsed: "gemini-2.5-flash",
        tokensUsed: 5,
      })
      .mockResolvedValueOnce(textResult("Trovate cerniere E10073.10.16"));
    queryRaw.mockResolvedValueOnce([hit]).mockResolvedValueOnce([{ total: 1 }]);

    const service = new ChatService(db, gateway);
    await service.send({ conversationId: "c1", agentId: "a1", content: "cerniere?" });

    const toolMessage = messageCreate.mock.calls[1]![0].data;
    expect(toolMessage).toMatchObject({
      role: "TOOL",
      toolName: "search_products",
      toolInput: { query: "cerniera" },
    });
    const assistant = messageCreate.mock.calls[2]![0].data;
    expect(assistant.referencedProductIds).toEqual(["p1"]);
    expect(assistant.tokensUsed).toBe(15); // somma dei round
    // il secondo round riceve il risultato tool nel transcript
    const secondTranscript = chat.mock.calls[1]![0];
    expect(secondTranscript.at(-1)).toMatchObject({ role: "tool", toolName: "search_products" });
  });

  it("al round 5 forza la risposta finale senza tool", async () => {
    chat.mockImplementation((_m: unknown, tools: unknown[]) =>
      Promise.resolve(
        tools.length > 0
          ? {
              text: null,
              toolCalls: [{ id: "x", name: "get_product_by_code", arguments: { agbCode: "B1" } }],
              modelUsed: "m",
              tokensUsed: 1,
            }
          : textResult("basta tool"),
      ),
    );
    findUnique.mockResolvedValue(null);
    const service = new ChatService(db, gateway);
    await service.send({ conversationId: "c1", agentId: "a1", content: "x" });
    expect(chat).toHaveBeenCalledTimes(6); // 5 round con tool + 1 forzato senza
    expect(chat.mock.calls[5]![1]).toEqual([]); // ultimo giro: niente tool
  });
});

describe("ChatService — errori", () => {
  it("fallimento AI → ASSISTANT status ERROR con errorMessage", async () => {
    chat.mockRejectedValueOnce(new Error("Assistente momentaneamente non disponibile."));
    const service = new ChatService(db, gateway);
    const result = await service.send({ conversationId: "c1", agentId: "a1", content: "x" });
    const assistant = messageCreate.mock.calls[1]![0].data;
    expect(assistant).toMatchObject({
      role: "ASSISTANT",
      status: "ERROR",
      errorMessage: "Assistente momentaneamente non disponibile.",
    });
    expect(result.assistantMessageId).toBe("m_ASSISTANT");
  });

  it("RateLimitedError viene rilanciata (il router la mappa su TOO_MANY_REQUESTS)", async () => {
    chat.mockRejectedValueOnce(new RateLimitedError());
    const service = new ChatService(db, gateway);
    await expect(
      service.send({ conversationId: "c1", agentId: "a1", content: "x" }),
    ).rejects.toMatchObject({ name: "RateLimitedError" });
    expect(messageCreate).toHaveBeenCalledTimes(1); // solo il messaggio USER
  });
});

describe("ChatService.retry", () => {
  it("cancella gli ASSISTANT in ERROR e rigenera dalla storia", async () => {
    messageFindMany.mockResolvedValue([{ role: "USER", content: "cerniere?" }]);
    chat.mockResolvedValueOnce(textResult("Riprovato ok"));
    const service = new ChatService(db, gateway);
    await service.retry({ conversationId: "c1", agentId: "a1" });
    expect(messageDeleteMany).toHaveBeenCalledWith({
      where: { conversationId: "c1", role: "ASSISTANT", status: "ERROR" },
    });
    // storia: system + user (nessun nuovo messaggio USER)
    expect(chat.mock.calls[0]![0]).toEqual([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: "cerniere?" },
    ]);
    expect(messageCreate.mock.calls[0]![0].data.role).toBe("ASSISTANT");
  });
});
