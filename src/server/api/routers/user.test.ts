import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";

// `user.ts` calls `auth.api.*` (Better Auth admin plugin). Mocked so setRole/setActive
// tests never construct the real Better Auth instance or touch a real database —
// mirrors the pattern in `settings.test.ts` (vi.hoisted + vi.mock factory).
const { createUserApi, setRoleApi, banApi, unbanApi, setPasswordApi, removeUserApi } = vi.hoisted(
  () => ({
    createUserApi: vi.fn(),
    setRoleApi: vi.fn(),
    banApi: vi.fn(),
    unbanApi: vi.fn(),
    setPasswordApi: vi.fn(),
    removeUserApi: vi.fn(),
  }),
);
vi.mock("@/server/auth/config", () => ({
  auth: {
    api: {
      createUser: createUserApi,
      setRole: setRoleApi,
      banUser: banApi,
      unbanUser: unbanApi,
      setUserPassword: setPasswordApi,
      removeUser: removeUserApi,
    },
  },
}));

import { userRouter } from "./user";

const appRouter = createTRPCRouter({ user: userRouter });

// Minimal `db.user` stub for the anti-lockout helper (findUnique/count) and the
// setActive status update. Reset before each test in the describe blocks below.
const userFindUnique = vi.fn();
const userFindFirst = vi.fn();
const userCount = vi.fn();
const userUpdate = vi.fn();
const kitRequestCount = vi.fn();
const conversationCount = vi.fn();
const settingsCount = vi.fn();
const dbStub = {
  user: { findUnique: userFindUnique, findFirst: userFindFirst, count: userCount, update: userUpdate },
  kitRequest: { count: kitRequestCount },
  conversation: { count: conversationCount },
  settings: { count: settingsCount },
};

const makeCtx = (session: unknown, db: unknown = {}): TRPCContext => ({
  db: db as TRPCContext["db"],
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
    await expect(caller.user.create({ ...input, email: "not-an-email" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects a too-short password with BAD_REQUEST", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin));
    await expect(caller.user.create({ ...input, password: "short" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("user.create (username / senza email)", () => {
  beforeEach(() => {
    createUserApi.mockReset();
    userFindUnique.mockReset();
    userUpdate.mockReset();
  });

  it("con username e senza email → sintetizza email-segnaposto e passa username", async () => {
    userFindUnique.mockResolvedValueOnce(null); // nessun clash sullo username
    createUserApi.mockResolvedValueOnce({
      user: { id: "newUser1", email: "mrossi@no-email.ufptrade.local" },
    });
    let updateArgs: { where: unknown; data: Record<string, unknown> } | undefined;
    userUpdate.mockImplementationOnce((args: { where: unknown; data: Record<string, unknown> }) => {
      updateArgs = args;
      return Promise.resolve({ id: "newUser1", ...args.data });
    });
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));

    await caller.user.create({
      username: "mrossi",
      firstName: "Mario",
      lastName: "Rossi",
      password: "password1",
      role: "AGENT",
    });

    expect(createUserApi).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ email: "mrossi@no-email.ufptrade.local" }),
      }),
    );
    expect(updateArgs?.data).toMatchObject({ username: "mrossi", displayUsername: "mrossi" });
  });

  it("rifiuta se manca sia email sia username", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    // Messaggio verbatim del refine (vedi user.ts): "Fornisci almeno un'email o uno username."
    // — nota "un'email o UNO username", per cui un regex tipo /email o username/ non la intercetta.
    await expect(
      caller.user.create({ firstName: "A", lastName: "B", password: "password1", role: "AGENT" }),
    ).rejects.toThrow("Fornisci almeno un'email o uno username");
    expect(createUserApi).not.toHaveBeenCalled();
  });

  it("rifiuta username già in uso (CONFLICT, senza chiamare Better Auth)", async () => {
    userFindUnique.mockResolvedValueOnce({ id: "existing1" }); // clash sullo username
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    await expect(
      caller.user.create({
        username: "mrossi",
        firstName: "Mario",
        lastName: "Rossi",
        password: "password1",
        role: "AGENT",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(createUserApi).not.toHaveBeenCalled();
  });
});

describe("user.setRole", () => {
  beforeEach(() => {
    setRoleApi.mockReset().mockResolvedValue(undefined);
    userFindUnique.mockReset();
    userCount.mockReset();
  });

  it("declassa un ADMIN se resta un altro admin attivo", async () => {
    userFindUnique.mockResolvedValueOnce({ role: "ADMIN" }); // u2 è admin (2 admin attivi: admin1 + u2)
    userCount.mockResolvedValueOnce(1); // admin1 resta attivo
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    const res = await caller.user.setRole({ id: "u2", role: "AGENT" });
    expect(res).toEqual({ id: "u2", role: "AGENT" });
    expect(setRoleApi).toHaveBeenCalledWith(
      expect.objectContaining({ body: { userId: "u2", role: "AGENT" } }),
    );
  });

  it("promuove un AGENT ad ADMIN senza controllare l'ultimo admin", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    const res = await caller.user.setRole({ id: "u3", role: "ADMIN" });
    expect(res).toEqual({ id: "u3", role: "ADMIN" });
    expect(userFindUnique).not.toHaveBeenCalled(); // guardia ultimo-admin salta se role !== "AGENT"
    expect(setRoleApi).toHaveBeenCalledWith(
      expect.objectContaining({ body: { userId: "u3", role: "ADMIN" } }),
    );
  });

  it("BLOCCA il declassamento dell'ultimo admin attivo", async () => {
    userFindUnique.mockResolvedValueOnce({ role: "ADMIN" });
    userCount.mockResolvedValueOnce(0); // nessun altro admin attivo
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    await expect(caller.user.setRole({ id: "uAdminUnico", role: "AGENT" })).rejects.toThrow(
      /almeno un amministratore/i,
    );
    expect(setRoleApi).not.toHaveBeenCalled();
  });

  it("BLOCCA l'operazione su sé stessi", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    await expect(caller.user.setRole({ id: admin.user.id, role: "AGENT" })).rejects.toThrow(
      /tuo stesso account/i,
    );
    expect(setRoleApi).not.toHaveBeenCalled();
  });
});

describe("user.setActive", () => {
  beforeEach(() => {
    banApi.mockReset().mockResolvedValue(undefined);
    unbanApi.mockReset().mockResolvedValue(undefined);
    userFindUnique.mockReset();
    userCount.mockReset();
    userUpdate.mockReset().mockResolvedValue(undefined);
  });

  it("disattiva → banUser + status INACTIVE", async () => {
    userFindUnique.mockResolvedValueOnce({ role: "AGENT" }); // non-admin: niente guardia ultimo-admin
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    const res = await caller.user.setActive({ id: "u2", active: false });
    expect(banApi).toHaveBeenCalledWith(expect.objectContaining({ body: { userId: "u2" } }));
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u2" }, data: { status: "INACTIVE" } }),
    );
    expect(res.status).toBe("INACTIVE");
  });

  it("riattiva → unbanUser + status ACTIVE", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    const res = await caller.user.setActive({ id: "u2", active: true });
    expect(unbanApi).toHaveBeenCalledWith(expect.objectContaining({ body: { userId: "u2" } }));
    expect(userFindUnique).not.toHaveBeenCalled(); // guardia ultimo-admin salta se active === true
    expect(res.status).toBe("ACTIVE");
  });

  it("BLOCCA disattivare l'ultimo admin attivo e sé stessi", async () => {
    userFindUnique.mockResolvedValueOnce({ role: "ADMIN" });
    userCount.mockResolvedValueOnce(0);
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    await expect(caller.user.setActive({ id: "uAdminUnico", active: false })).rejects.toThrow(
      /almeno un amministratore/i,
    );
    await expect(caller.user.setActive({ id: admin.user.id, active: false })).rejects.toThrow(
      /tuo stesso account/i,
    );
    expect(banApi).not.toHaveBeenCalled();
  });
});

describe("user.resetPassword", () => {
  beforeEach(() => {
    setPasswordApi.mockReset().mockResolvedValue(undefined);
  });

  it("imposta una nuova password (min 8) via admin API", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    const res = await caller.user.resetPassword({ id: "u2", password: "nuovapass1" });
    expect(setPasswordApi).toHaveBeenCalledWith(
      expect.objectContaining({ body: { userId: "u2", newPassword: "nuovapass1" } }),
    );
    expect(res).toEqual({ id: "u2" });
  });

  it("rifiuta password < 8", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    await expect(caller.user.resetPassword({ id: "u2", password: "corta" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(setPasswordApi).not.toHaveBeenCalled();
  });
});

describe("user.update", () => {
  beforeEach(() => {
    userFindFirst.mockReset();
    userUpdate
      .mockReset()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "u2", ...data }),
      );
  });

  it("aggiorna nome/cognome e ricompone name (nessun controllo unicità se email/username assenti)", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    const res = await caller.user.update({ id: "u2", firstName: "Mario", lastName: "Rossi" });
    expect(res.firstName).toBe("Mario");
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u2" },
        data: { firstName: "Mario", lastName: "Rossi", name: "Mario Rossi" },
      }),
    );
    expect(userFindFirst).not.toHaveBeenCalled();
  });

  it("cambia email e username quando non ci sono conflitti", async () => {
    userFindFirst.mockResolvedValue(null); // nessun conflitto né su email né su username
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    const res = await caller.user.update({
      id: "u2",
      firstName: "Mario",
      lastName: "Rossi",
      email: "mario@rossi.it",
      username: "MRossi",
    });
    expect(userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "mario@rossi.it", id: { not: "u2" } } }),
    );
    expect(userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { username: "mrossi", id: { not: "u2" } } }),
    );
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "mario@rossi.it",
          username: "mrossi",
          displayUsername: "MRossi",
        }),
      }),
    );
    expect(res.email).toBe("mario@rossi.it");
  });

  it("BLOCCA (CONFLICT) il cambio email già in uso da un altro utente", async () => {
    userFindFirst.mockResolvedValueOnce({ id: "other" }); // clash sull'email
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    await expect(
      caller.user.update({ id: "u2", firstName: "Mario", lastName: "Rossi", email: "mario@rossi.it" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("BLOCCA (CONFLICT) il cambio username già in uso da un altro utente", async () => {
    userFindFirst.mockResolvedValueOnce({ id: "other" }); // clash sullo username
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    await expect(
      caller.user.update({ id: "u2", firstName: "Mario", lastName: "Rossi", username: "mrossi" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(userUpdate).not.toHaveBeenCalled();
  });
});

describe("user.delete", () => {
  beforeEach(() => {
    removeUserApi.mockReset().mockResolvedValue(undefined);
    userFindUnique.mockReset();
    userCount.mockReset();
    kitRequestCount.mockReset();
    conversationCount.mockReset();
    settingsCount.mockReset();
  });

  it("elimina se 0 record collegati", async () => {
    userFindUnique.mockResolvedValueOnce({ role: "AGENT" }); // non-admin: niente guardia ultimo-admin
    kitRequestCount.mockResolvedValueOnce(0);
    conversationCount.mockResolvedValueOnce(0);
    settingsCount.mockResolvedValueOnce(0);
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    const res = await caller.user.delete({ id: "u2" });
    expect(removeUserApi).toHaveBeenCalledWith(expect.objectContaining({ body: { userId: "u2" } }));
    expect(res).toEqual({ id: "u2" });
  });

  it("BLOCCA (CONFLICT) se ha record collegati", async () => {
    userFindUnique.mockResolvedValueOnce({ role: "AGENT" });
    kitRequestCount.mockResolvedValueOnce(2);
    conversationCount.mockResolvedValueOnce(0);
    settingsCount.mockResolvedValueOnce(0);
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    await expect(caller.user.delete({ id: "u3" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/record collegati|disattiv/i),
    });
    expect(removeUserApi).not.toHaveBeenCalled();
  });

  it("BLOCCA (CONFLICT) se ha impostazioni collegate (Settings.updatedBy, kit/conv = 0)", async () => {
    userFindUnique.mockResolvedValueOnce({ role: "AGENT" });
    kitRequestCount.mockResolvedValueOnce(0);
    conversationCount.mockResolvedValueOnce(0);
    settingsCount.mockResolvedValueOnce(1);
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    await expect(caller.user.delete({ id: "u4" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/record collegati|disattiv/i),
    });
    expect(removeUserApi).not.toHaveBeenCalled();
  });

  it("BLOCCA sé stessi e l'ultimo admin attivo", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin, dbStub));
    await expect(caller.user.delete({ id: admin.user.id })).rejects.toThrow(/tuo stesso account/i);

    userFindUnique.mockResolvedValueOnce({ role: "ADMIN" });
    userCount.mockResolvedValueOnce(0);
    await expect(caller.user.delete({ id: "uAdminUnico" })).rejects.toThrow(
      /almeno un amministratore/i,
    );
    expect(removeUserApi).not.toHaveBeenCalled();
  });
});
