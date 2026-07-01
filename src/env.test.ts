import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  DIRECT_URL: "postgresql://u:p@localhost:5432/db",
  NEXTAUTH_URL: "http://localhost:3000",
  NEXTAUTH_SECRET: "at-least-32-chars-xxxxxxxxxxxxxxxxxx",
  REDIS_URL: "redis://localhost:6379",
  IP_HASH_SECRET: "some-secret",
  NODE_ENV: "test",
};

describe("parseEnv", () => {
  it("throws when NEXTAUTH_SECRET is missing", () => {
    const { NEXTAUTH_SECRET, ...withoutSecret } = valid;
    expect(() => parseEnv(withoutSecret)).toThrow();
  });

  it("throws when NEXTAUTH_SECRET is shorter than 32 chars", () => {
    expect(() => parseEnv({ ...valid, NEXTAUTH_SECRET: "too-short" })).toThrow();
  });

  it("throws when DATABASE_URL is not a valid URL", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: "not-a-url" })).toThrow();
  });

  it("parses a valid environment and applies defaults", () => {
    const env = parseEnv(valid);
    expect(env.NEXTAUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.GEMINI_MODEL).toBe("gemini-2.5-flash");
    expect(env.NODE_ENV).toBe("test");
    expect(env.GEMINI_API_KEY).toBeUndefined();
  });
});
