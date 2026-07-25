import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
import { chatRouter } from "./chat";

const appRouter = createTRPCRouter({ chat: chatRouter });

const conversationCreate = vi.fn();
const conversationFindFirst = vi.fn();
const conversationFindMany = vi.fn();
const conversationUpdate = vi.fn();
const messageFindMany = vi.fn();
const productFindMany = vi.fn();
const activityCreate = vi.fn();

const makeCtx = (session: unknown): TRPCContext =>
  ({
    db: {
      conversation: {
        create: conversationCreate,
        findFirst: conversationFindFirst,
        findMany: conversationFindMany,
        update: conversationUpdate,
      },
      message: { findMany: messageFindMany },
      product: { findMany: productFindMany },
      activityLog: { create: activityCreate },
    },
    session,
    headers: new Headers(),
  }) as unknown as TRPCContext;

const agent = { user: { id: "agent1", role: "AGENT", status: "ACTIVE" } };
const ownConversation = {
  id: "c1",
  agentId: "agent1",
  title: "Nuova Conversazione",
  status: "ACTIVE",
};

beforeEach(() => {
  conversationCreate.mockReset();
  conversationFindFirst.mockReset();
  conversationFindMany.mockReset();
  conversationUpdate.mockReset();
  conversationUpdate.mockResolvedValue({});
  messageFindMany.mockReset();
  messageFindMany.mockResolvedValue([]);
  productFindMany.mockReset();
  productFindMany.mockResolvedValue([]);
  activityCreate.mockReset();
  activityCreate.mockResolvedValue({});
});

describe("RBAC e ownership", () => {
  it("get senza sessione → UNAUTHORIZED", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(null));
    await expect(caller.chat.get({ conversationId: "c1" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("conversazione di un altro agente → NOT_FOUND", async () => {
    conversationFindFirst.mockResolvedValue(null);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.chat.get({ conversationId: "altrui" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(conversationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ agentId: "agent1" }) }),
    );
  });
});

describe("chat.create", () => {
  it("crea la conversazione e logga CONVERSATION_CREATED", async () => {
    conversationCreate.mockResolvedValue({ id: "c9", title: "Nuova Conversazione" });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const created = await caller.chat.create();
    expect(created).toEqual({ id: "c9", title: "Nuova Conversazione" });
    expect(activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "CONVERSATION_CREATED", userId: "agent1" }),
    });
  });
});

describe("chat.list", () => {
  it("filtra per titolo quando è passato search", async () => {
    conversationFindMany.mockResolvedValue([]);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.chat.list({ search: "cerniere" });
    expect(conversationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          title: { contains: "cerniere", mode: "insensitive" },
        }),
      }),
    );
  });

  it("senza search non filtra per titolo", async () => {
    conversationFindMany.mockResolvedValue([]);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.chat.list();
    const where = conversationFindMany.mock.calls.at(-1)![0].where;
    expect(where).not.toHaveProperty("title");
  });
});

describe("chat.get", () => {
  it("ritorna i prodotti citati PER MESSAGGIO, non un elenco unico appiattito", async () => {
    conversationFindFirst.mockResolvedValue(ownConversation);
    messageFindMany.mockResolvedValue([
      { id: "m1", role: "USER", content: "ciao", referencedProductIds: [] },
      { id: "m2", role: "ASSISTANT", content: "ecco", referencedProductIds: ["p1"] },
      { id: "m3", role: "ASSISTANT", content: "altro", referencedProductIds: ["p1", "p2"] },
    ]);
    productFindMany.mockResolvedValue([
      {
        id: "p1",
        agbCode: "B1",
        name: "X",
        shortDescription: null,
        basePrice: { toString: () => "2.5" },
        priceUnit: "EUR",
        isAvailable: true,
        stockQuantity: 0,
        listinoPage: 12,
      },
      {
        id: "p2",
        agbCode: "B2",
        name: "Y",
        shortDescription: null,
        basePrice: { toString: () => "9" },
        priceUnit: "EUR",
        isAvailable: true,
        stockQuantity: 1,
        listinoPage: null,
      },
    ]);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const thread = await caller.chat.get({ conversationId: "c1" });

    // Una sola query per risolvere l'unione degli id citati (dedup su tutti i messaggi).
    expect(productFindMany).toHaveBeenCalledTimes(1);
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["p1", "p2"] } } }),
    );

    expect(thread.messages).toHaveLength(3);
    expect(thread.messages[0]?.products).toEqual([]);
    expect(thread.messages[1]?.products).toEqual([expect.objectContaining({ id: "p1", basePrice: 2.5 })]);
    expect(thread.messages[2]?.products?.map((p) => p.id)).toEqual(["p1", "p2"]);
    // niente elenco appiattito conversation-wide
    expect(thread).not.toHaveProperty("products");
  });
});

describe("chat.rename", () => {
  it("aggiorna il titolo della propria conversazione", async () => {
    conversationFindFirst.mockResolvedValue(ownConversation);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const result = await caller.chat.rename({ conversationId: "c1", title: "Cerniere ARTECH" });
    expect(result).toEqual({ ok: true });
    expect(conversationUpdate).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { title: "Cerniere ARTECH" },
    });
  });

  it("titolo vuoto → BAD_REQUEST", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.chat.rename({ conversationId: "c1", title: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("conversazione altrui → NOT_FOUND", async () => {
    conversationFindFirst.mockResolvedValue(null);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.chat.rename({ conversationId: "altrui", title: "X" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("chat.delete", () => {
  it("imposta status DELETED sulla propria conversazione", async () => {
    conversationFindFirst.mockResolvedValue(ownConversation);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const result = await caller.chat.delete({ conversationId: "c1" });
    expect(result).toEqual({ ok: true });
    expect(conversationUpdate).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "DELETED" },
    });
  });

  it("una conversazione DELETED sparisce da ownConversation (get → NOT_FOUND)", async () => {
    // ownConversation esclude status DELETED nel where; il mock findFirst simula il DB
    // che applica quel filtro restituendo null per una conversazione già cancellata.
    conversationFindFirst.mockResolvedValue(null);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.chat.get({ conversationId: "c1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("chat.archive", () => {
  it("archivia la conversazione propria", async () => {
    conversationFindFirst.mockResolvedValue(ownConversation);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.chat.archive({ conversationId: "c1" });
    expect(conversationUpdate).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "ARCHIVED" },
    });
  });
});
