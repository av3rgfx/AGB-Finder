import "server-only";
import { env } from "@/env";
import { db } from "@/server/db";
import { getKeysVersion, resolveApiKey } from "@/server/settings/service";
import { CircuitBreaker } from "./breaker";
import { RateLimiter } from "./ratelimit";
import { getRedis, type RedisLike } from "./redis";
import { GeminiEmbeddingService, type EmbeddingService } from "./embedding";
import {
  AINotConfiguredError,
  AIUnavailableError,
  ProviderHttpError,
  RateLimitedError,
} from "./errors";
import { GeminiChatProvider } from "./providers/gemini";
import { KimiChatProvider } from "./providers/kimi";
import type { ChatMessage, ChatProvider, ChatResult, ToolDeclaration } from "./providers/types";

export interface GatewayDeps {
  providers: ChatProvider[];
  breaker: CircuitBreaker;
  limiter: RateLimiter;
  queryEmbeddings?: EmbeddingService;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const USER_RPM = 20;
const PROVIDER_RPM = 60; // cap di sicurezza globale per provider (tutti gli utenti)
const WINDOW_SEC = 60;
const DEFAULT_TIMEOUT_MS = 30_000;

function isRetriable(error: unknown): boolean {
  return error instanceof ProviderHttpError && (error.status === 429 || error.status >= 500);
}

/** Adapter EmbeddingService → embedQuery: lancia su null, il RAGEngine cattura e degrada. */
class QueryEmbeddings implements EmbeddingService {
  constructor(private readonly gateway: AIGateway) {}

  async generate(text: string): Promise<number[]> {
    const vector = await this.gateway.embedQuery(text);
    if (!vector) throw new Error("Embedding query non disponibile");
    return vector;
  }
}

/**
 * UNICO punto di uscita verso i provider AI (regola di progetto, come il
 * RAGEngine per il raw SQL): rate limit per utente e per provider, circuit
 * breaker distribuito, timeout 30s, 1 retry con jitter su 429/5xx, fallback
 * Gemini→Kimi. Qualunque errore di un provider fa scattare il fallback.
 */
export class AIGateway {
  private readonly timeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly deps: GatewayDeps) {
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async chat(
    messages: ChatMessage[],
    tools: ToolDeclaration[],
    opts: { userId: string },
  ): Promise<ChatResult> {
    if (this.deps.providers.length === 0) throw new AINotConfiguredError();
    if (!(await this.deps.limiter.consume(`user:${opts.userId}`, USER_RPM, WINDOW_SEC)))
      throw new RateLimitedError();

    let skippedForBudget = false;
    let sawFailure = false;
    for (const provider of this.deps.providers) {
      if (await this.deps.breaker.isOpen(provider.name)) {
        sawFailure = true; // breaker aperto = provider notoriamente giù
        continue;
      }
      if (
        !(await this.deps.limiter.consume(`provider:${provider.name}`, PROVIDER_RPM, WINDOW_SEC))
      ) {
        skippedForBudget = true;
        continue;
      }
      try {
        const result = await this.callWithRetry(provider, messages, tools);
        await this.deps.breaker.recordSuccess(provider.name);
        return result;
      } catch (error) {
        console.warn(`AIGateway: provider ${provider.name} fallito`, error);
        await this.deps.breaker.recordFailure(provider.name);
        sawFailure = true;
      }
    }
    // Saltati solo per budget → è un problema di carico, non di disponibilità.
    if (skippedForBudget && !sawFailure) throw new RateLimitedError();
    throw new AIUnavailableError();
  }

  /** Embedding della query di ricerca: null su qualunque errore → degrado al ramo testuale. */
  async embedQuery(text: string): Promise<number[] | null> {
    if (!this.deps.queryEmbeddings) return null;
    try {
      return await this.deps.queryEmbeddings.generate(text);
    } catch (error) {
      console.warn("AIGateway.embedQuery fallito, degrado al testuale:", error);
      return null;
    }
  }

  /** EmbeddingService per il RAGEngine, o undefined se Gemini non è configurato. */
  queryEmbeddings(): EmbeddingService | undefined {
    return this.deps.queryEmbeddings ? new QueryEmbeddings(this) : undefined;
  }

  private async callWithRetry(
    provider: ChatProvider,
    messages: ChatMessage[],
    tools: ToolDeclaration[],
  ): Promise<ChatResult> {
    try {
      return await provider.chat(messages, tools, AbortSignal.timeout(this.timeoutMs));
    } catch (error) {
      if (!isRetriable(error)) throw error;
      await this.sleep(200 + Math.random() * 400); // jitter
      return provider.chat(messages, tools, AbortSignal.timeout(this.timeoutMs));
    }
  }
}

let singleton: AIGateway | null = null;
let cachedVersion = -1;
let checkedAt = 0;
const VERSION_TTL_MS = 30_000;

async function buildGateway(redis: RedisLike): Promise<AIGateway> {
  const geminiKey = await resolveApiKey(db, "gemini");
  const kimiKey = await resolveApiKey(db, "kimi");
  const providers: ChatProvider[] = [];
  if (geminiKey) providers.push(new GeminiChatProvider(geminiKey, env.GEMINI_MODEL));
  if (kimiKey) providers.push(new KimiChatProvider(kimiKey, env.KIMI_MODEL));
  const queryEmbeddings = geminiKey
    ? new GeminiEmbeddingService(geminiKey, "RETRIEVAL_QUERY", (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(3000) }),
      )
    : undefined;
  return new AIGateway({
    providers,
    breaker: new CircuitBreaker(redis),
    limiter: new RateLimiter(redis),
    queryEmbeddings,
  });
}

/**
 * Gateway di produzione: le key sono risolte DB-prima-poi-env dal settings service.
 * Il singleton viene ricostruito quando cambia il version-stamp su Redis (rilettura
 * al più ogni VERSION_TTL_MS), così una rotazione key da /impostazioni ha effetto
 * senza redeploy. Disallineamento massimo tra istanze serverless = VERSION_TTL_MS.
 */
export async function getAIGateway(): Promise<AIGateway> {
  const now = Date.now();
  if (singleton && now - checkedAt < VERSION_TTL_MS) return singleton;
  const redis = getRedis();
  const version = await getKeysVersion(redis);
  checkedAt = now;
  if (singleton && version === cachedVersion) return singleton;
  cachedVersion = version;
  singleton = await buildGateway(redis);
  return singleton;
}
