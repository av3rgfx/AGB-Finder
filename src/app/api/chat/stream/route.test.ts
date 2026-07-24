import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimitedError } from "@/server/ai/errors";
import type { ChatEvent } from "@/server/chat/events";

const {
  getSession,
  conversationFindFirst,
  conversationUpdate,
  getAIGateway,
  ChatServiceCtor,
  persistUserMessage,
  deleteLastAssistant,
} = vi.hoisted(() => ({
  getSession: vi.fn(),
  conversationFindFirst: vi.fn(),
  conversationUpdate: vi.fn(),
  getAIGateway: vi.fn(),
  ChatServiceCtor: vi.fn(),
  persistUserMessage: vi.fn(),
  deleteLastAssistant: vi.fn(),
}));

vi.mock("@/server/auth/config", () => ({ auth: { api: { getSession } } }));
vi.mock("@/server/db", () => ({
  db: { conversation: { findFirst: conversationFindFirst, update: conversationUpdate } },
}));
vi.mock("@/server/ai/gateway", () => ({ getAIGateway }));

/** Generatore scriptabile per-test: assegnato in ogni test, letto dal costruttore mockato sotto. */
let generateStreamImpl: (...args: unknown[]) => AsyncGenerator<ChatEvent>;

vi.mock("@/server/chat/service", () => ({
  ChatService: ChatServiceCtor.mockImplementation(() => ({
    persistUserMessage,
    deleteLastAssistant,
    generateStream: (...args: unknown[]) => generateStreamImpl(...args),
  })),
}));

import { POST } from "./route";

function req(body: unknown): Request {
  return new Request("http://x/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function* gen(events: ChatEvent[]): AsyncGenerator<ChatEvent> {
  for (const e of events) yield e;
}

function throwingGen(error: unknown): AsyncGenerator<ChatEvent> {
  return (async function* () {
    throw error;
  })();
}

/** Legge tutti i frame `data: {...}\n\n` di una Response SSE. */
async function readEvents(res: Response): Promise<ChatEvent[]> {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((frame) => JSON.parse(frame.replace(/^data: /, "")) as ChatEvent);
}

beforeEach(() => {
  getSession.mockReset();
  conversationFindFirst.mockReset();
  conversationUpdate.mockReset();
  conversationUpdate.mockResolvedValue({});
  getAIGateway.mockReset();
  getAIGateway.mockResolvedValue({});
  ChatServiceCtor.mockClear();
  persistUserMessage.mockReset();
  deleteLastAssistant.mockReset();
  generateStreamImpl = () => gen([{ type: "delta", text: "ciao" }]);
});

describe("POST /api/chat/stream", () => {
  it("senza sessione → 401 (non tocca il DB)", async () => {
    getSession.mockResolvedValue(null);
    const res = await POST(req({ conversationId: "c1", content: "ciao", mode: "send" }));
    expect(res.status).toBe(401);
    expect(conversationFindFirst).not.toHaveBeenCalled();
  });

  it("body non-JSON → 400", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    const res = await POST(
      new Request("http://x/api/chat/stream", { method: "POST", body: "non-json" }),
    );
    expect(res.status).toBe(400);
  });

  it("body che fallisce lo zod schema → 400", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    const res = await POST(req({ conversationId: "c1", mode: "boh" }));
    expect(res.status).toBe(400);
    expect(conversationFindFirst).not.toHaveBeenCalled();
  });

  it("mode 'send' senza content → 400 (non tocca il DB)", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    const res = await POST(req({ conversationId: "c1", mode: "send" }));
    expect(res.status).toBe(400);
    expect(conversationFindFirst).not.toHaveBeenCalled();
  });

  it("conversazione non trovata o non di proprietà → 404", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    conversationFindFirst.mockResolvedValue(null);
    const res = await POST(req({ conversationId: "c1", content: "ciao", mode: "send" }));
    expect(res.status).toBe(404);
    expect(conversationFindFirst).toHaveBeenCalledWith({
      where: { id: "c1", agentId: "u1", status: { not: "DELETED" } },
      select: { id: true, title: true },
    });
  });

  it("send valido → 200 SSE, persiste il messaggio utente e rititola la conversazione di default", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    conversationFindFirst.mockResolvedValue({ id: "c1", title: "Nuova Conversazione" });
    generateStreamImpl = () =>
      gen([
        { type: "delta", text: "ciao" },
        { type: "done", messageId: "m1", products: [], tokens: 5 },
      ]);

    const res = await POST(req({ conversationId: "c1", content: "Come va?", mode: "send" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(res.headers.get("connection")).toBe("keep-alive");
    expect(res.headers.get("x-accel-buffering")).toBe("no");

    expect(persistUserMessage).toHaveBeenCalledWith("c1", "Come va?");
    expect(conversationUpdate).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { title: "Come va?" },
    });

    const events = await readEvents(res);
    expect(events).toEqual([
      { type: "delta", text: "ciao" },
      { type: "done", messageId: "m1", products: [], tokens: 5 },
    ]);
  });

  it("send su conversazione già titolata → non ritocca il titolo", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    conversationFindFirst.mockResolvedValue({ id: "c1", title: "Anta ribalta ARTECH" });

    const res = await POST(req({ conversationId: "c1", content: "ciao", mode: "send" }));
    await res.text();

    expect(conversationUpdate).not.toHaveBeenCalled();
  });

  it("mode 'regenerate' → elimina l'ultimo ASSISTANT, non persiste un messaggio utente", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    conversationFindFirst.mockResolvedValue({ id: "c1", title: "Anta ribalta ARTECH" });

    const res = await POST(req({ conversationId: "c1", mode: "regenerate" }));
    await res.text();

    expect(deleteLastAssistant).toHaveBeenCalledWith("c1");
    expect(persistUserMessage).not.toHaveBeenCalled();
    expect(conversationUpdate).not.toHaveBeenCalled();
  });

  it("RateLimitedError durante lo streaming → evento error recuperabile", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    conversationFindFirst.mockResolvedValue({ id: "c1", title: "Anta ribalta ARTECH" });
    generateStreamImpl = () => throwingGen(new RateLimitedError());

    const res = await POST(req({ conversationId: "c1", mode: "regenerate" }));
    const events = await readEvents(res);

    expect(events).toEqual([
      { type: "error", recoverable: true, message: "Assistente momentaneamente occupato" },
    ]);
  });

  it("errore generico durante lo streaming → evento error non-recuperabile", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    conversationFindFirst.mockResolvedValue({ id: "c1", title: "Anta ribalta ARTECH" });
    generateStreamImpl = () => throwingGen(new Error("boom"));

    const res = await POST(req({ conversationId: "c1", mode: "regenerate" }));
    const events = await readEvents(res);

    expect(events).toEqual([{ type: "error", recoverable: false, message: "Errore imprevisto" }]);
  });

  it("passa conversationId, agentId e req.signal a generateStream", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    conversationFindFirst.mockResolvedValue({ id: "c1", title: "Anta ribalta ARTECH" });
    const spy = vi.fn(() => gen([]));
    generateStreamImpl = spy;

    const request = req({ conversationId: "c1", mode: "regenerate" });
    const res = await POST(request);
    await res.text();

    expect(spy).toHaveBeenCalledWith("c1", "u1", request.signal);
  });
});
