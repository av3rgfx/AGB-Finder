import { describe, it, expect } from "vitest";
import {
  createTRPCRouter,
  createCallerFactory,
  adminProcedure,
  agentProcedure,
  authedProcedure,
  type TRPCContext,
} from "./trpc";

const router = createTRPCRouter({
  adminOnly: adminProcedure.query(() => "admin-ok"),
  agentOnly: agentProcedure.query(() => "agent-ok"),
  authedOnly: authedProcedure.query(() => "authed-ok"),
});

const ctx = (session: unknown): TRPCContext => ({
  db: {} as TRPCContext["db"],
  session: session as TRPCContext["session"],
  headers: new Headers(),
});
const call = (session: unknown) => createCallerFactory(router)(ctx(session));

const admin = { user: { id: "a", role: "ADMIN", status: "ACTIVE" } };
const agent = { user: { id: "b", role: "AGENT", status: "ACTIVE" } };

describe("RBAC procedures", () => {
  it("rejects anonymous access with UNAUTHORIZED", async () => {
    await expect(call(null).authedOnly()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("adminProcedure rejects AGENT with FORBIDDEN", async () => {
    await expect(call(agent).adminOnly()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("adminProcedure allows ADMIN", async () => {
    expect(await call(admin).adminOnly()).toBe("admin-ok");
  });

  it("agentProcedure allows both AGENT and ADMIN", async () => {
    expect(await call(agent).agentOnly()).toBe("agent-ok");
    expect(await call(admin).agentOnly()).toBe("agent-ok");
  });

  it("rejects a SUSPENDED (non-ACTIVE) user with FORBIDDEN", async () => {
    await expect(
      call({ user: { id: "c", role: "ADMIN", status: "SUSPENDED" } }).adminOnly(),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
