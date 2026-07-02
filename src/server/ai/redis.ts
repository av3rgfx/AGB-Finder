import "server-only";
import Redis from "ioredis";
import { env } from "@/env";

/** Sottoinsieme minimo di comandi Redis usato da breaker e rate limiter. */
export interface RedisCommands {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ex: "EX", seconds: number): Promise<unknown>;
  del(key: string): Promise<number>;
}

let client: Redis | null = null;

/** Singleton ioredis su REDIS_URL (Docker in dev, Upstash TCP in prod). */
export function getRedis(): RedisCommands {
  client ??= new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 });
  return client;
}

/** Usato quando l'AI non è configurata: nessun provider → mai invocato davvero. */
export class NullRedis implements RedisCommands {
  incr(): Promise<number> {
    return Promise.resolve(1);
  }
  expire(): Promise<number> {
    return Promise.resolve(1);
  }
  get(): Promise<string | null> {
    return Promise.resolve(null);
  }
  set(): Promise<unknown> {
    return Promise.resolve("OK");
  }
  del(): Promise<number> {
    return Promise.resolve(0);
  }
}
