import "server-only";
import { env } from "@/env";
import type { AiProvider } from "@/server/settings/service";
import { GeminiChatProvider } from "./providers/gemini";
import type { ChatProvider } from "./providers/types";

const PING_TIMEOUT_MS = 8_000;

export interface TestConnectionResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Ping minimo a un provider con una key data. Nessuna persistenza.
 * `provider` è tenuto in firma (oggi sempre "gemini") per simmetria col resto
 * della settings surface — vedi `AiProvider` in `@/server/settings/service`.
 */
export async function testProviderKey(
  provider: AiProvider,
  apiKey: string,
): Promise<TestConnectionResult> {
  const client: ChatProvider = new GeminiChatProvider(apiKey, env.GEMINI_MODEL);
  const started = Date.now();
  try {
    await client.chat([{ role: "user", content: "ping" }], [], AbortSignal.timeout(PING_TIMEOUT_MS));
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Errore sconosciuto" };
  }
}
