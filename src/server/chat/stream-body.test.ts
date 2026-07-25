import { describe, it, expect } from "vitest";
import { streamBodySchema, DEFAULT_CONVERSATION_TITLE } from "./stream-body";

describe("streamBodySchema", () => {
  it("accetta un invio valido", () => {
    const parsed = streamBodySchema.safeParse({
      conversationId: "c1",
      content: "ciao",
      mode: "send",
    });
    expect(parsed.success).toBe(true);
  });

  it("accetta una rigenerazione senza content", () => {
    const parsed = streamBodySchema.safeParse({ conversationId: "c1", mode: "regenerate" });
    expect(parsed.success).toBe(true);
    // Assente = nessuna risposta da sostituire: il service non cancellerà niente.
    expect(parsed.success && parsed.data.regenerateMessageId).toBeUndefined();
  });

  it("accetta una rigenerazione con l'id della risposta da rifare", () => {
    const parsed = streamBodySchema.safeParse({
      conversationId: "c1",
      mode: "regenerate",
      regenerateMessageId: "a1",
    });
    expect(parsed.success && parsed.data.regenerateMessageId).toBe("a1");
  });

  it("rifiuta un regenerateMessageId vuoto (mai un id fasullo verso la delete)", () => {
    expect(
      streamBodySchema.safeParse({
        conversationId: "c1",
        mode: "regenerate",
        regenerateMessageId: "",
      }).success,
    ).toBe(false);
  });

  it("rifiuta conversationId mancante o vuoto", () => {
    expect(streamBodySchema.safeParse({ mode: "send", content: "ciao" }).success).toBe(false);
    expect(
      streamBodySchema.safeParse({ conversationId: "", mode: "send", content: "ciao" }).success,
    ).toBe(false);
  });

  it("rifiuta mode mancante o sconosciuto", () => {
    expect(streamBodySchema.safeParse({ conversationId: "c1" }).success).toBe(false);
    expect(
      streamBodySchema.safeParse({ conversationId: "c1", mode: "delete" }).success,
    ).toBe(false);
  });

  it("rifiuta content vuoto, solo-spazi o troppo lungo", () => {
    expect(
      streamBodySchema.safeParse({ conversationId: "c1", mode: "send", content: "" }).success,
    ).toBe(false);
    expect(
      streamBodySchema.safeParse({ conversationId: "c1", mode: "send", content: "   " }).success,
    ).toBe(false);
    expect(
      streamBodySchema.safeParse({
        conversationId: "c1",
        mode: "send",
        content: "a".repeat(4001),
      }).success,
    ).toBe(false);
  });

  it("accetta content esattamente a 4000 caratteri e lo mantiene trimmato", () => {
    const content = "a".repeat(4000);
    const parsed = streamBodySchema.safeParse({ conversationId: "c1", mode: "send", content });
    expect(parsed.success).toBe(true);

    const trimmed = streamBodySchema.safeParse({
      conversationId: "c1",
      mode: "send",
      content: "  ciao  ",
    });
    expect(trimmed.success && trimmed.data.content).toBe("ciao");
  });
});

describe("DEFAULT_CONVERSATION_TITLE", () => {
  it("coincide col default dello schema Prisma", () => {
    expect(DEFAULT_CONVERSATION_TITLE).toBe("Nuova Conversazione");
  });
});
