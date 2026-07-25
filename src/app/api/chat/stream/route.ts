import { auth } from "@/server/auth/config";
import { db } from "@/server/db";
import { getAIGateway } from "@/server/ai/gateway";
import { ChatService } from "@/server/chat/service";
import { encodeSSE } from "@/server/chat/stream-encode";
import { streamBodySchema, DEFAULT_CONVERSATION_TITLE } from "@/server/chat/stream-body";
import { chatUserFacingError } from "@/server/chat/error-message";
import type { ChatEvent } from "@/server/chat/events";

// Unica eccezione al vincolo "tutte le API via tRPC" (vedi CLAUDE.md): lo streaming SSE non è
// esprimibile su httpBatchLink. Stesso pattern auth della route handler tRPC (getSession sugli
// header) e stesso maxDuration (cap piano Vercel Hobby; il loop tool-use può superare i 10s
// di default).
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const parsed = streamBodySchema.safeParse(json);
  if (!parsed.success) return new Response("Bad Request", { status: 400 });
  const { conversationId, content, mode } = parsed.data;
  if (mode === "send" && !content) return new Response("Bad Request", { status: 400 });

  const owned = await db.conversation.findFirst({
    where: { id: conversationId, agentId: session.user.id, status: { not: "DELETED" } },
    select: { id: true, title: true },
  });
  if (!owned) return new Response("Not Found", { status: 404 });

  const service = new ChatService(db, await getAIGateway());

  if (mode === "send") {
    // `content` è garantito non-vuoto dal guard sopra; ricontrollato qui per restringere il tipo.
    if (!content) return new Response("Bad Request", { status: 400 });
    await service.persistUserMessage(conversationId, content);
    if (owned.title === DEFAULT_CONVERSATION_TITLE) {
      await db.conversation.update({
        where: { id: conversationId },
        data: { title: content.slice(0, 60) },
      });
    }
  } else {
    await service.deleteLastAssistant(conversationId);
  }

  const encoder = new TextEncoder();
  // Vero una volta chiuso/cancellato: guardia contro `enqueue`/`close` dopo che il client si è
  // disconnesso. NON è il meccanismo di cancellazione (vedi `cancel()` sotto) — serve solo a
  // rendere innocuo l'`enqueue` che il generatore, ancora in corsa, prova a fare nel frattempo.
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeSSE(event)));
        } catch {
          // Il controller non accetta più `enqueue` (stream già chiuso/cancellato lato client):
          // ignoriamo l'evento, il generatore prosegue comunque fino a persistere il messaggio.
          closed = true;
        }
      };

      try {
        for await (const event of service.generateStream(conversationId, session.user.id, req.signal)) {
          send(event);
        }
      } catch (error) {
        // Errore uscito DAL generatore (il ChatService gestisce e logga i propri): niente
        // dettagli grezzi al client, solo la copia italiana condivisa con il service.
        console.warn("chat/stream: errore fuori dal generatore", error);
        send({ type: "error", ...chatUserFacingError(error) });
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            // Già chiuso/cancellato dal runtime nel frattempo: nessuna azione necessaria.
          }
          closed = true;
        }
      }
    },
    cancel() {
      // Il client si è disconnesso. NON fermiamo `service.generateStream` da qui — niente
      // `.return()`/`.throw()` sul generatore, mai: generateStream persiste il messaggio
      // ASSISTANT sul proprio percorso normale/di errore (deliberatamente MAI in un `finally`,
      // vedi ChatService), quindi una chiusura forzata dall'esterno salterebbe quella scrittura
      // e perderebbe silenziosamente la risposta parziale. Lo stop reale passa da `req.signal`:
      // la piattaforma lo aborta alla disconnessione, l'abort si propaga fino al fetch del
      // provider dentro AIGateway, e il generatore se ne accorge da solo, persiste il parziale e
      // termina il proprio `for await` — che a sua volta chiude quello qui sopra normalmente. Qui
      // ci limitiamo a marcare lo stream chiuso così i successivi `send()` restano no-op.
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
