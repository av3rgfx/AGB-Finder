import { describe, it, expect, vi } from "vitest";
import { authorizeUser, type AuthUserRecord } from "./config";

const base: AuthUserRecord = {
  id: "u1",
  email: "a@b.it",
  passwordHash: "hash",
  firstName: "Anna",
  lastName: "Bianchi",
  role: "AGENT",
  status: "ACTIVE",
};

describe("authorizeUser", () => {
  it("returns null when credentials are missing", async () => {
    const res = await authorizeUser(undefined, {
      findUser: vi.fn(),
      compare: vi.fn(),
    });
    expect(res).toBeNull();
  });

  it("returns null when the user is not found", async () => {
    const res = await authorizeUser(
      { email: "a@b.it", password: "x" },
      { findUser: vi.fn().mockResolvedValue(null), compare: vi.fn().mockResolvedValue(true) },
    );
    expect(res).toBeNull();
  });

  it("returns null for a non-ACTIVE (suspended) user", async () => {
    const res = await authorizeUser(
      { email: "a@b.it", password: "x" },
      {
        findUser: vi.fn().mockResolvedValue({ ...base, status: "SUSPENDED" }),
        compare: vi.fn().mockResolvedValue(true),
      },
    );
    expect(res).toBeNull();
  });

  it("returns null when the password does not match", async () => {
    const compare = vi.fn().mockResolvedValue(false);
    const res = await authorizeUser(
      { email: "a@b.it", password: "wrong" },
      { findUser: vi.fn().mockResolvedValue(base), compare },
    );
    expect(res).toBeNull();
    expect(compare).toHaveBeenCalledWith("wrong", "hash");
  });

  it("returns the safe user on valid credentials and never leaks passwordHash", async () => {
    const res = await authorizeUser(
      { email: "a@b.it", password: "ok" },
      { findUser: vi.fn().mockResolvedValue(base), compare: vi.fn().mockResolvedValue(true) },
    );
    expect(res).toEqual({
      id: "u1",
      email: "a@b.it",
      firstName: "Anna",
      lastName: "Bianchi",
      role: "AGENT",
      status: "ACTIVE",
    });
    expect((res as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
  });
});
