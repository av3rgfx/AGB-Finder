import { describe, it, expect } from "vitest";
import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
import { userRouter } from "./user";

const appRouter = createTRPCRouter({ user: userRouter });

const makeCtx = (session: unknown): TRPCContext => ({
  db: {} as TRPCContext["db"],
  session: session as TRPCContext["session"],
  headers: new Headers(),
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

describe("user.create authorization", () => {
  it("rejects a non-admin caller with FORBIDDEN (before touching Better Auth)", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.user.create(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an invalid email with BAD_REQUEST (input validation)", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin));
    await expect(
      caller.user.create({ ...input, email: "not-an-email" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects a too-short password with BAD_REQUEST", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin));
    await expect(
      caller.user.create({ ...input, password: "short" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
