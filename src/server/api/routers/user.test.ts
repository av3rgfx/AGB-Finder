import { describe, it, expect, vi } from "vitest";
import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
import { userRouter } from "./user";

const appRouter = createTRPCRouter({ user: userRouter });

const makeCtx = (session: unknown, db: unknown): TRPCContext => ({
  db: db as TRPCContext["db"],
  session: session as TRPCContext["session"],
});

const admin = { user: { id: "admin1", role: "ADMIN", status: "ACTIVE" } };
const agent = { user: { id: "agent1", role: "AGENT", status: "ACTIVE" } };
const input = {
  email: "mario@rossi.it",
  firstName: "Mario",
  lastName: "Rossi",
  password: "password123",
  role: "AGENT" as const,
};

describe("user.create", () => {
  it("rejects a non-admin caller with FORBIDDEN", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent, {}));
    await expect(caller.user.create(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("hashes the password (never stores plaintext) and omits it from the row", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "u1",
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: "AGENT",
      status: "ACTIVE",
      createdAt: new Date(),
    });
    const findUnique = vi.fn().mockResolvedValue(null);
    const caller = createCallerFactory(appRouter)(makeCtx(admin, { user: { create, findUnique } }));

    const result = await caller.user.create(input);

    expect(findUnique).toHaveBeenCalledWith({ where: { email: input.email } });
    expect(create).toHaveBeenCalledOnce();
    const data = create.mock.calls[0]![0].data as Record<string, unknown>;
    expect(typeof data.passwordHash).toBe("string");
    expect(data.passwordHash).not.toBe(input.password);
    expect(data).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("passwordHash");
  });

  it("rejects a duplicate email with CONFLICT", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "existing" });
    const create = vi.fn();
    const caller = createCallerFactory(appRouter)(makeCtx(admin, { user: { create, findUnique } }));
    await expect(caller.user.create(input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(create).not.toHaveBeenCalled();
  });
});
