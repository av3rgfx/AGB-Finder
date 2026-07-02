import type { RedisCommands } from "./redis";

/**
 * Rate limiter a finestra fissa: 1 INCR (+1 EXPIRE alla prima) per check.
 * Sufficiente a proteggere quota provider e equità per-utente (YAGNI:
 * niente sliding window).
 */
export class RedisRateLimiter {
  constructor(private readonly redis: RedisCommands) {}

  /** true se la chiamata rientra nel budget `limit` per `windowSeconds`. */
  async consume(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const count = await this.redis.incr(`rl:${key}`);
    if (count === 1) await this.redis.expire(`rl:${key}`, windowSeconds);
    return count <= limit;
  }
}
