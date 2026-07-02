import type { RedisCommands } from "./redis";

export interface BreakerOptions {
  failureThreshold: number;
  failureWindowSeconds: number;
  openSeconds: number;
}

export const DEFAULT_BREAKER_OPTIONS: BreakerOptions = {
  failureThreshold: 5,
  failureWindowSeconds: 60,
  openSeconds: 30,
};

/**
 * Circuit breaker con stato su Redis: le lambda serverless non condividono
 * memoria, quindi un breaker in-process non "aprirebbe" mai globalmente.
 * Half-open implicito: alla scadenza del TTL di `open` la prima chiamata
 * fa da probe (un fallimento ri-conta da capo).
 */
export class RedisCircuitBreaker {
  constructor(
    private readonly redis: RedisCommands,
    private readonly opts: BreakerOptions = DEFAULT_BREAKER_OPTIONS,
  ) {}

  async isOpen(provider: string): Promise<boolean> {
    return (await this.redis.get(`cb:${provider}:open`)) !== null;
  }

  async recordFailure(provider: string): Promise<void> {
    const failures = await this.redis.incr(`cb:${provider}:fail`);
    if (failures === 1) {
      await this.redis.expire(`cb:${provider}:fail`, this.opts.failureWindowSeconds);
    }
    if (failures >= this.opts.failureThreshold) {
      await this.redis.set(`cb:${provider}:open`, "1", "EX", this.opts.openSeconds);
      await this.redis.del(`cb:${provider}:fail`);
    }
  }

  async recordSuccess(provider: string): Promise<void> {
    await this.redis.del(`cb:${provider}:fail`);
  }
}
