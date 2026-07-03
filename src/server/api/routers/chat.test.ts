import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
import { chatRouter } from "./chat";

const appRouter = createTRPCRouter({ chat: chatRouter });

const conversationCreate = vi.fn();
const conversationFindFirst = vi.fn();
const conversationFindMany = vi.fn();
const conversationUpdate = vi.fn();
const messageCreate = vi.fn();
const messageFindMany = vi.fn();
const messageDeleteMany = vi.fn();
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
      message: { create: messageCreate, findMany: messageFindMany, deleteMany: messageDeleteMany },
      product: { findMany: productFindMany, findUnique: vi.fn() },
      activityLog: { create: activityCreate },
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
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
  messageCreate.mockReset();
  messageCreate.mockImplementation(({ data }: { data: { role: string } }) =>
    Promise.resolve({ id: "m1", ...data }),
  );
  messageFindMany.mockReset();
  messageFindMany.mockResolvedValue([]);
  messageDeleteMany.mockReset();
  messageDeleteMany.mockResolvedValue({ count: 0 });
  productFindMany.mockReset();
  activityCreate.mockReset();
  activityCreate.mockResolvedValue({});
});

describe("RBAC e ownership", () => {
  it("send senza sessione → UNAUTHORIZED", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(null));
    await expect(caller.chat.send({ conversationId: "c1", content: "ciao" })).rejects.toMatchObject(
      { code: "UNAUTHORIZED" },
    );
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

describe("chat.send", () => {
  it("titola la conversazione col primo messaggio e logga CONVERSATION_MESSAGE", async () => {
    conversationFindFirst.mockResolvedValue(ownConversation);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const result = await caller.chat.send({ conversationId: "c1", content: "Cerco cerniere" });
    expect(result.assistantMessageId).toBe("m1");
    expect(conversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { title: "Cerco cerniere" } }),
    );
    expect(activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "CONVERSATION_MESSAGE" }),
    });
    // senza key configurate il gateway non è configurato → ASSISTANT ERROR persistito
    const assistant = messageCreate.mock.calls.at(-1)![0].data;
    expect(assistant).toMatchObject({
      role: "ASSISTANT",
      status: "ERROR",
      errorMessage: "Assistente non configurato.",
    });
  });

  it("valida il contenuto (vuoto → BAD_REQUEST)", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.chat.send({ conversationId: "c1", content: "  " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("chat.get", () => {
  it("ritorna messaggi USER/ASSISTANT e le schede dei prodotti citati", async () => {
    conversationFindFirst.mockResolvedValue(ownConversation);
    messageFindMany.mockResolvedValue([
      { id: "m1", role: "USER", content: "ciao", referencedProductIds: [] },
      { id: "m2", role: "ASSISTANT", content: "ecco", referencedProductIds: ["p1"] },
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
      },
    ]);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const thread = await caller.chat.get({ conversationId: "c1" });
    expect(thread.messages).toHaveLength(2);
    expect(thread.products[0]).toMatchObject({ id: "p1", basePrice: 2.5 });
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["p1"] } } }),
    );
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
