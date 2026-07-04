import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { AIGateway } from "@/server/ai/gateway";
import { RateLimitedError } from "@/server/ai/errors";
import type { ChatMessage } from "@/server/ai/providers/types";
import { TOOL_DECLARATIONS, executeTool, type ToolDb } from "./tools";

export type ChatDb = ToolDb & Pick<PrismaClient, "message">;

const MAX_TOOL_ROUNDS = 5;

export const SYSTEM_PROMPT = `Sei l'assistente tecnico-commerciale di Utensilferramenta Pistoiese per il catalogo ferramenta AGB. Rispondi in italiano agli agenti di vendita.
Regole:
- Usa SEMPRE i tool per cercare i prodotti: non inventare mai codici, prezzi o specifiche.
- Cita sempre il codice AGB dei prodotti di cui parli.
- Se una ricerca dà 0 risultati, riprova SUBITO nello stesso turno con termini più generali o senza filtri: non annunciare mai che farai un'altra ricerca, falla e basta. Rispondi all'utente solo quando hai risultati definitivi.
- Se non trovi nulla neanche senza filtri, dillo chiaramente e suggerisci come riformulare la ricerca.
- Non trattare generazione kit o argomenti fuori dal catalogo AGB.
- Scrivi in testo semplice senza markdown (niente asterischi o grassetti): per gli elenchi usa trattini, ogni prodotto su una riga.`;

export interface SendResult {
  assistantMessageId: string;
}

/**
 * Orchestrazione di un turno di chat: persiste il messaggio USER prima della
 * chiamata AI, esegue il loop tool-use (cap MAX_TOOL_ROUNDS, poi forza la
 * risposta senza tool) e persiste TOOL + ASSISTANT con i metadati.
 */
export class ChatService {
  constructor(
    private readonly db: ChatDb,
    private readonly gateway: AIGateway,
  ) {}

  async send(opts: {
    conversationId: string;
    agentId: string;
    content: string;
  }): Promise<SendResult> {
    await this.db.message.create({
      data: { conversationId: opts.conversationId, role: "USER", content: opts.content },
    });
    return this.generate(opts.conversationId, opts.agentId);
  }

  /** «Riprova»: elimina gli ASSISTANT in errore e rigenera senza duplicare il messaggio utente. */
  async retry(opts: { conversationId: string; agentId: string }): Promise<SendResult> {
    await this.db.message.deleteMany({
      where: { conversationId: opts.conversationId, role: "ASSISTANT", status: "ERROR" },
    });
    return this.generate(opts.conversationId, opts.agentId);
  }

  private async generate(conversationId: string, agentId: string): Promise<SendResult> {
    const startedAt = Date.now();
    const transcript: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(await this.loadHistory(conversationId)),
    ];
    const productIds = new Set<string>();
    let tokens = 0;

    try {
      for (let round = 0; ; round++) {
        const useTools = round < MAX_TOOL_ROUNDS;
        const result = await this.gateway.chat(transcript, useTools ? TOOL_DECLARATIONS : [], {
          userId: agentId,
        });
        tokens += result.tokensUsed ?? 0;

        if (result.toolCalls.length === 0 || !useTools) {
          const assistant = await this.db.message.create({
            data: {
              conversationId,
              role: "ASSISTANT",
              content: result.text ?? "",
              modelUsed: result.modelUsed,
              tokensUsed: tokens,
              latencyMs: Date.now() - startedAt,
              referencedProductIds: [...productIds],
            },
          });
          return { assistantMessageId: assistant.id };
        }

        transcript.push({ role: "assistant", content: result.text, toolCalls: result.toolCalls });
        for (const call of result.toolCalls) {
          const execution = await executeTool(
            this.db,
            call.name,
            call.arguments,
            this.gateway.queryEmbeddings(),
          );
          for (const id of execution.productIds) productIds.add(id);
          await this.db.message.create({
            data: {
              conversationId,
              role: "TOOL",
              content: `Tool ${call.name}`,
              toolName: call.name,
              toolInput: call.arguments as Prisma.InputJsonValue,
              toolOutput: execution.output as Prisma.InputJsonValue,
            },
          });
          transcript.push({
            role: "tool",
            toolCallId: call.id,
            toolName: call.name,
            content: JSON.stringify(execution.output),
          });
        }
      }
    } catch (error) {
      if (error instanceof RateLimitedError) throw error; // il router la mappa su TOO_MANY_REQUESTS
      const assistant = await this.db.message.create({
        data: {
          conversationId,
          role: "ASSISTANT",
          content: "",
          status: "ERROR",
          errorMessage: error instanceof Error ? error.message : "Errore sconosciuto",
          latencyMs: Date.now() - startedAt,
        },
      });
      return { assistantMessageId: assistant.id };
    }
  }

  /** Storia per il modello: solo USER/ASSISTANT inviati (i round tool restano nel DB, non nel prompt). */
  private async loadHistory(conversationId: string): Promise<ChatMessage[]> {
    const rows = await this.db.message.findMany({
      where: { conversationId, role: { in: ["USER", "ASSISTANT"] }, status: "SENT" },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });
    return rows.map((row) =>
      row.role === "USER"
        ? ({ role: "user", content: row.content } as const)
        : ({ role: "assistant", content: row.content } as const),
    );
  }
}
