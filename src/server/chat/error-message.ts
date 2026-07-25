import "server-only";
import { RateLimitedError } from "@/server/ai/errors";

/** Copie utente (italiano) degli errori del percorso chat. Unica fonte: sia il ChatService sia
 * la route handler SSE devono emettere ESATTAMENTE queste stringhe. */
export const CHAT_ERROR_BUSY = "Assistente momentaneamente occupato";
export const CHAT_ERROR_GENERIC = "Errore imprevisto";

/**
 * Traduce un errore qualunque nella coppia (recuperabile, copia utente) da mandare al client.
 *
 * I messaggi grezzi dei provider sono in inglese e pieni di dettagli interni
 * («This operation was aborted.», «gemini: HTTP 429»): non devono MAI raggiungere la UI, che è
 * in italiano (regola inviolabile di progetto) e non deve esporre i nomi/particolari dei
 * provider. Il messaggio originale va tenuto nei log lato server, non nell'evento SSE né nella
 * colonna `errorMessage`.
 */
export function chatUserFacingError(error: unknown): { recoverable: boolean; message: string } {
  const recoverable = error instanceof RateLimitedError;
  return { recoverable, message: recoverable ? CHAT_ERROR_BUSY : CHAT_ERROR_GENERIC };
}
