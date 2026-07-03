import type { RedisLike } from "@/server/ai/redis";

/** Redis in-memory con clock controllabile: advance() fa scadere i TTL. Solo per i test. */
export class FakeRedis implements RedisLike {
  private store = new Map<string, { value: string; expiresAt: number | null }>();
  private now = 0;

  advance(seconds: number): void {
    this.now += seconds * 1000;
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

  set(key: string, value: string, _ex: "EX", seconds: number): Promise<string> {
    this.store.set(key, { value, expiresAt: this.now + seconds * 1000 });
    return Promise.resolve("OK");
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.live(key)?.value ?? null);
  }

  del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) if (this.store.delete(key)) removed += 1;
    return Promise.resolve(removed);
  }
}
