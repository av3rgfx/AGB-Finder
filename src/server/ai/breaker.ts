import type { RedisLike } from "./redis";

export interface BreakerOptions {
  failureThreshold: number;
  failWindowSec: number;
  openSec: number;
}

const DEFAULTS: BreakerOptions = { failureThreshold: 5, failWindowSec: 60, openSec: 30 };

/**
 * Circuit breaker distribuito per provider AI. Stato SOLO su Redis: le lambda
 * Vercel non condividono memoria. TTL della chiave open scaduto = half-open
 * (la prima chiamata successiva fa da probe).
 */
export class CircuitBreaker {
  constructor(
    private readonly redis: RedisLike,
    private readonly opts: BreakerOptions = DEFAULTS,
  ) {}

  async isOpen(provider: string): Promise<boolean> {
    return (await this.redis.get(`cb:${provider}:open`)) !== null;
  }

  async recordFailure(provider: string): Promise<void> {
    const failures = await this.redis.incr(`cb:${provider}:fail`);
    if (failures === 1) await this.redis.expire(`cb:${provider}:fail`, this.opts.failWindowSec);
    if (failures >= this.opts.failureThreshold) {
      await this.redis.set(`cb:${provider}:open`, "1", "EX", this.opts.openSec);
      await this.redis.del(`cb:${provider}:fail`);
    }
  }

  async recordSuccess(provider: string): Promise<void> {
    await this.redis.del(`cb:${provider}:fail`);
  }
}
