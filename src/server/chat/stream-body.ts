import { z } from "zod";

/** Stesso default di `Conversation.title` in prisma/schema.prisma e del router `chat` legacy:
 * finché il titolo resta questo, il primo `send` lo rimpiazza con l'incipit del messaggio. */
export const DEFAULT_CONVERSATION_TITLE = "Nuova Conversazione";

/** Body di `POST /api/chat/stream`. */
export const streamBodySchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().trim().min(1).max(4000).optional(),
  mode: z.enum(["send", "regenerate"]),
  /** Solo con `mode: "regenerate"`: id della riga ASSISTANT che il client intende rifare. La
   * cancellazione lato server avviene SOLO se questa riga è ancora l'ultima della conversazione
   * (vedi `ChatService.deleteLastAssistant`). Assente = «ritenta il turno fallito», che non ha
   * prodotto nessuna risposta: si ri-genera senza cancellare niente. */
  regenerateMessageId: z.string().min(1).optional(),
});

export type StreamBody = z.infer<typeof streamBodySchema>;
