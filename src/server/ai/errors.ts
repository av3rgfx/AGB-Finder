/** Errori tipizzati del layer AI: il router li traduce in TRPCError; i messaggi sono già in italiano. */
export class RateLimitedError extends Error {
  constructor() {
    super("Troppe richieste, riprova tra poco.");
    this.name = "RateLimitedError";
  }
}

export class AINotConfiguredError extends Error {
  constructor() {
    super("Assistente non configurato.");
    this.name = "AINotConfiguredError";
  }
}

export class AIUnavailableError extends Error {
  constructor() {
    super("Assistente momentaneamente non disponibile.");
    this.name = "AIUnavailableError";
  }
}

/** Risposta HTTP non-2xx da un provider; lo status guida retry (429/5xx) e fallback. */
export class ProviderHttpError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
  ) {
    super(`${provider}: HTTP ${status}`);
    this.name = "ProviderHttpError";
  }
}
