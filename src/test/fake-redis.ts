import type { RedisCommands } from "@/server/ai/redis";

/** Redis in-memory con clock finto per i test (TTL deterministici). */
export class FakeRedis implements RedisCommands {
  private store = new Map<string, { value: string; expiresAt: number | null }>();
  private now = 0;

  advance(ms: number): void {
    this.now += ms;
  }

  private live(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= this.now) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  incr(key: string): Promise<number> {
    const entry = this.live(key);
    const next = entry ? Number(entry.value) + 1 : 1;
    this.store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
    return Promise.resolve(next);
  }

  expire(key: string, seconds: number): Promise<number> {
    const entry = this.live(key);
    if (!entry) return Promise.resolve(0);
    entry.expiresAt = this.now + seconds * 1000;
    return Promise.resolve(1);
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.live(key)?.value ?? null);
  }

  set(key: string, value: string, _ex: "EX", seconds: number): Promise<unknown> {
    this.store.set(key, { value, expiresAt: this.now + seconds * 1000 });
    return Promise.resolve("OK");
  }

  del(key: string): Promise<number> {
    return Promise.resolve(this.store.delete(key) ? 1 : 0);
  }
}
