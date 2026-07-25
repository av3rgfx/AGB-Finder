import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { AIGateway } from "@/server/ai/gateway";
import { RateLimitedError } from "@/server/ai/errors";
import type { ChatMessage, ToolCall } from "@/server/ai/providers/types";
import type { ChatEvent } from "./events";
import { toolLabel } from "./events";
import { CHAT_ERROR_BUSY, chatUserFacingError } from "./error-message";
import { resolveChatProducts } from "./products";
import { TOOL_DECLARATIONS, executeTool, type ToolDb } from "./tools";

export type ChatDb = ToolDb & Pick<PrismaClient, "message" | "conversation" | "product">;

/** Cap dei round tool nel percorso streaming: più basso del non-streaming (5) per stare nel
 * limite di 60s delle funzioni Vercel — ogni round tool aggiunge una round-trip al provider. */
const STREAM_MAX_TOOL_ROUNDS = 3;

export const SYSTEM_PROMPT = `Sei l'assistente tecnico-commerciale di Utensilferramenta Pistoiese per il catalogo ferramenta AGB. Rispondi in italiano agli agenti di vendita.
Regole:
- Usa SEMPRE i tool per cercare i prodotti: non inventare mai codici, prezzi o specifiche.
- Cita sempre il codice AGB dei prodotti di cui parli.
- Se una ricerca dà 0 risultati, riprova SUBITO nello stesso turno con termini più generali o senza filtri: non annunciare mai che farai un'altra ricerca, falla e basta. Rispondi solo quando hai risultati definitivi.
- Se non trovi nulla neanche senza filtri, dillo chiaramente e suggerisci come riformulare.
- Non trattare generazione kit o argomenti fuori dal catalogo AGB.
- Formatta con markdown conciso: elenchi puntati per più prodotti, **grassetto** per evidenziare, tabelle solo quando confronti più valori. Tieni le risposte brevi.`;

/**
 * Orchestrazione streaming di un turno di chat: legge la storia, esegue il loop tool-use
 * (cap STREAM_MAX_TOOL_ROUNDS round, poi forza la risposta senza tool) inoltrando i chunk del
 * gateway come eventi via SSE, e persiste un'unica riga ASSISTANT a fine turno con il testo
 * accumulato, i metadati e i prodotti citati.
 */
export class ChatService {
  constructor(
    private readonly db: ChatDb,
    private readonly gateway: AIGateway,
  ) {}

  async persistUserMessage(conversationId: string, content: string): Promise<void> {
    await this.db.message.create({ data: { conversationId, role: "USER", content } });
  }

  /**
   * «Rigenera»: elimina la risposta da rifare, ma SOLO se il client ha dichiarato QUALE risposta
   * intende rifare (`expectedAssistantId`) e quella risposta è ancora l'ultima riga
   * USER|ASSISTANT della conversazione. Nessun id o id che non coincide ⇒ non si cancella niente.
   * Mai cancellare «l'ultimo ASSISTANT» a indovinare: è un'operazione irreversibile.
   *
   * Le due forme che senza questa guardia distruggerebbero dati:
   * - **coda USER** — il turno è morto prima di produrre una risposta (es. rate limit
   *   pre-primo-token: `generateStream` esce senza persistere nulla), quindi la risposta ASSISTANT
   *   più recente è quella BUONA del turno PRECEDENTE;
   * - **coda ASSISTANT ma non quella dichiarata** — la richiesta non ha MAI raggiunto il server
   *   (agente offline): nemmeno la riga USER è stata scritta, e la coda è ancora la risposta buona
   *   del turno precedente. È lo scenario reale «l'agente perde campo a metà domanda».
   *
   * Una risposta cancellata qui sparirebbe anche dal transcript inviato al modello.
   */
  async deleteLastAssistant(
    conversationId: string,
    expectedAssistantId: string | undefined,
  ): Promise<void> {
    if (!expectedAssistantId) return;
    const last = await this.db.message.findFirst({
      where: { conversationId, role: { in: ["USER", "ASSISTANT"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, role: true },
    });
    if (last?.role === "ASSISTANT" && last.id === expectedAssistantId) {
      await this.db.message.delete({ where: { id: last.id } });
    }
  }

  async *generateStream(
    conversationId: string,
    agentId: string,
    signal: AbortSignal,
  ): AsyncGenerator<ChatEvent> {
    const startedAt = Date.now();
    const transcript: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(await this.loadHistory(conversationId)),
    ];
    const productIds = new Set<string>();
    let tokens = 0;
    let finalText = "";
    let errored: { message: string } | null = null;

    try {
      for (let round = 0; ; round++) {
        const useTools = round < STREAM_MAX_TOOL_ROUNDS;
        const roundToolCalls: ToolCall[] = [];
        let roundText = "";
        for await (const chunk of this.gateway.chatStream(
          transcript,
          useTools ? TOOL_DECLARATIONS : [],
          { userId: agentId, signal },
        )) {
          if (chunk.type === "text-delta") {
            roundText += chunk.text;
            finalText += chunk.text;
            yield { type: "delta", text: chunk.text };
          } else if (chunk.type === "tool-call") {
            roundToolCalls.push(chunk.call);
          } else if (chunk.type === "usage") {
            tokens += chunk.tokens;
          }
        }
        if (roundToolCalls.length === 0 || !useTools) break; // risposta finale

        transcript.push({ role: "assistant", content: roundText || null, toolCalls: roundToolCalls });
        for (const call of roundToolCalls) {
          yield { type: "tool", phase: "start", tool: call.name, label: toolLabel(call.name) };
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
          yield {
            type: "tool",
            phase: "end",
            tool: call.name,
            label: toolLabel(call.name),
            count: execution.productIds.length,
          };
          transcript.push({
            role: "tool",
            toolCallId: call.id,
            toolName: call.name,
            content: JSON.stringify(execution.output),
          });
        }
        if (signal.aborted) break; // STOP tra un round e l'altro: esce senza un altro giro
      }
    } catch (error) {
      if (error instanceof RateLimitedError && finalText.length === 0) {
        // Pre-primo-token: nessuna riga ASSISTANT, il client ritenta con lo stesso invio.
        yield { type: "error", recoverable: true, retryAfter: 20, message: CHAT_ERROR_BUSY };
        return;
      }
      // STOP dell'utente: l'abort risale dal fetch al provider come eccezione, ma NON è un guasto —
      // stesso esito del break tra un round e l'altro (sopra). Senza questa guardia uno STOP premuto
      // prima del primo token lascerebbe nel thread una riga ASSISTANT `status: "ERROR"` fantasma,
      // permanente e vuota; col parziale già ricevuto si persiste invece normalmente come SENT.
      if (!signal.aborted) {
        // Il messaggio grezzo del provider (inglese, dettagli interni) resta solo nei log:
        // all'utente va la copia italiana di `chatUserFacingError`.
        console.warn("ChatService.generateStream: turno fallito", error);
        errored = { message: chatUserFacingError(error).message };
      }
    }

    // Persistenza unica a fine turno (niente riga PENDING/STREAMING intermedia, niente sweeper —
    // v2). Non in un `finally`: uno `yield` dentro `finally` risolve la promise di un eventuale
    // `.return()`/`.throw()` del consumer (es. un `for await` con `break`) invece di raggiungere
    // un `.next()` normale, quindi un evento terminale così emesso rischierebbe di non arrivare
    // mai al chiamante che si limita a esaurire il generatore con un `for await` semplice — qui
    // il `finally` farebbe solo la persistenza e lo yield resterebbe comunque fuori da esso.
    if (finalText.length > 0 || errored) {
      const assistant = await this.db.message.create({
        data: {
          conversationId,
          role: "ASSISTANT",
          content: finalText,
          status: errored && finalText.length === 0 ? "ERROR" : "SENT",
          errorMessage: errored && finalText.length === 0 ? errored.message : null,
          modelUsed: null,
          tokensUsed: tokens,
          latencyMs: Date.now() - startedAt,
          referencedProductIds: [...productIds],
        },
      });
      await this.touchConversation(conversationId);
      if (errored && finalText.length === 0) {
        yield { type: "error", recoverable: false, message: errored.message };
      } else {
        const products = await resolveChatProducts(this.db, [...productIds]);
        yield { type: "done", messageId: assistant.id, products, tokens };
      }
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

  /** Bump di updatedAt per l'ordinamento di `conversation.list`: valorizzato esplicitamente
   * (non `data: {}`) per non dipendere dal comportamento di Prisma su un update a dati vuoti. */
  private async touchConversation(conversationId: string): Promise<void> {
    await this.db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }
}
