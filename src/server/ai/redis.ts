import "server-only";
import Redis from "ioredis";
import { env } from "@/env";

/** Sottoinsieme minimo di ioredis usato da breaker e rate limiter (iniettabile nei test). */
export interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  set(key: string, value: string, ex: "EX", seconds: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<unknown>;
}

let client: Redis | null = null;

/** Client Redis condiviso, lazy: nessuna connessione finché non parte un comando. */
export function getRedis(): RedisLike {
  client ??= new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: true });
  return client;
}
