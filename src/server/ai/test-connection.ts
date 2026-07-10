import "server-only";
import { env } from "@/env";
import type { AiProvider } from "@/server/settings/service";
import { GeminiChatProvider } from "./providers/gemini";
import { KimiChatProvider } from "./providers/kimi";
import type { ChatProvider } from "./providers/types";

const PING_TIMEOUT_MS = 8_000;

export interface TestConnectionResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

/** Ping minimo a un provider con una key data. Nessuna persistenza. */
export async function testProviderKey(
  provider: AiProvider,
  apiKey: string,
): Promise<TestConnectionResult> {
  const client: ChatProvider =
    provider === "gemini"
      ? new GeminiChatProvider(apiKey, env.GEMINI_MODEL)
      : new KimiChatProvider(apiKey, env.KIMI_MODEL);
  const started = Date.now();
  try {
    await client.chat([{ role: "user", content: "ping" }], [], AbortSignal.timeout(PING_TIMEOUT_MS));
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Errore sconosciuto" };
  }
}
