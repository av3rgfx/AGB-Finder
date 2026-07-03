import type { RedisLike } from "./redis";

/**
 * Rate limiter a finestra fissa: chiave per finestra, il TTL pulisce da solo.
 * Sliding window è YAGNI per 20 msg/min.
 */
export class RateLimiter {
  constructor(
    private readonly redis: RedisLike,
    private readonly nowMs: () => number = Date.now,
  ) {}

  /** true = richiesta ammessa; false = limite superato. */
  async consume(key: string, limit: number, windowSec: number): Promise<boolean> {
    const window = Math.floor(this.nowMs() / (windowSec * 1000));
    const redisKey = `rl:${key}:${window}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) await this.redis.expire(redisKey, windowSec);
    return count <= limit;
  }
}
