import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCallerFactory, createTRPCRouter, type TRPCContext } from "@/server/api/trpc";
import { customerRouter } from "./customer";

const appRouter = createTRPCRouter({ customer: customerRouter });

const customerFindMany = vi.fn();
const customerCreate = vi.fn();
const customerUpdate = vi.fn();
const customerDelete = vi.fn();
const kitRequestCount = vi.fn();

const makeCtx = (session: unknown): TRPCContext =>
  ({
    db: {
      customer: {
        findMany: customerFindMany,
        create: customerCreate,
        update: customerUpdate,
        delete: customerDelete,
      },
      kitRequest: { count: kitRequestCount },
    },
    session,
    headers: new Headers(),
  }) as unknown as TRPCContext;

const agent = { user: { id: "agent1", role: "AGENT", status: "ACTIVE" } };

beforeEach(() => {
  for (const fn of [
    customerFindMany,
    customerCreate,
    customerUpdate,
    customerDelete,
    kitRequestCount,
  ]) {
    fn.mockReset();
  }
  customerFindMany.mockResolvedValue([]);
  kitRequestCount.mockResolvedValue(0);
});

describe("autorizzazione", () => {
  it("senza sessione nega", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(null));
    await expect(caller.customer.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("customer.list", () => {
  it("restituisce lo sconto come numero, non come Decimal", async () => {
    customerFindMany.mockResolvedValue([
      { id: "c1", companyName: "Fosca", discount: { toString: () => "42.5" } },
    ]);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.customer.list({})).resolves.toEqual([
      { id: "c1", companyName: "Fosca", discount: 42.5 },
    ]);
  });

  it("cerca per ragione sociale, senza distinguere maiuscole", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.customer.list({ search: "per" });
    expect(customerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyName: { contains: "per", mode: "insensitive" } },
      }),
    );
  });

  it("senza ricerca non filtra", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.customer.list({});
    expect(customerFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});

describe("customer.create", () => {
  it("crea con ragione sociale e sconto", async () => {
    customerCreate.mockResolvedValue({
      id: "c1",
      companyName: "MC",
      discount: { toString: () => "40" },
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.customer.create({ companyName: "MC", discount: 40 })).resolves.toEqual({
      id: "c1",
      companyName: "MC",
      discount: 40,
    });
  });

  it("lo sconto e` facoltativo", async () => {
    customerCreate.mockResolvedValue({ id: "c1", companyName: "MC", discount: null });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.customer.create({ companyName: "MC" })).resolves.toEqual({
      id: "c1",
      companyName: "MC",
      discount: null,
    });
  });

  it("rifiuta una ragione sociale vuota", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.customer.create({ companyName: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(customerCreate).not.toHaveBeenCalled();
  });

  it("rifiuta uno sconto fuori da 0-100", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.customer.create({ companyName: "MC", discount: 120 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rifiuta uno sconto con piu` di due decimali (la colonna e` Decimal(5,2))", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.customer.create({ companyName: "MC", discount: 40.555 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("customer.delete", () => {
  it("rifiuta se il cliente ha richieste collegate", async () => {
    kitRequestCount.mockResolvedValue(3);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.customer.delete({ id: "c1" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(customerDelete).not.toHaveBeenCalled();
  });

  it("elimina se non ne ha", async () => {
    kitRequestCount.mockResolvedValue(0);
    customerDelete.mockResolvedValue({ id: "c1" });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.customer.delete({ id: "c1" })).resolves.toEqual({ id: "c1" });
  });
});

/**
 * Profilo serramento: geometria ed entrata del cliente.
 *
 * Sono le due quote che non cambiano fra un ordine e l'altro dello stesso
 * cliente, e che oggi l'agente ri-sceglie a memoria fra 14 combinazioni a ogni
 * richiesta — sbagliandole senza che nulla lo segnali.
 */
describe("profilo serramento", () => {
  it("list lo restituisce", async () => {
    customerFindMany.mockResolvedValue([
      {
        id: "c1",
        companyName: "Fosca",
        discount: null,
        kitGeometry: "A12_I13_B18",
        kitEntrata: "E15",
      },
    ]);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.customer.list({})).resolves.toEqual([
      {
        id: "c1",
        companyName: "Fosca",
        discount: null,
        kitGeometry: "A12_I13_B18",
        kitEntrata: "E15",
      },
    ]);
  });

  it("create lo accetta, e senza profilo scrive NULL", async () => {
    customerCreate.mockResolvedValue({
      id: "c2",
      companyName: "Peruzzi",
      discount: null,
      kitGeometry: "A4_I9_B18",
      kitEntrata: null,
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.customer.create({ companyName: "Peruzzi", kitGeometry: "A4_I9_B18" });
    expect(customerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kitGeometry: "A4_I9_B18", kitEntrata: null }),
      }),
    );
  });

  it("create rifiuta una geometria che non esiste", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.customer.create({ companyName: "X", kitGeometry: "A99_I0_B0" as never }),
    ).rejects.toThrow();
    expect(customerCreate).not.toHaveBeenCalled();
  });

  // `undefined` (non toccare) e `null` (azzera) sono due cose diverse: un
  // cliente che cambia linea di serramento deve poter svuotare il profilo, e
  // svuotarlo non e` lasciarlo stare. Stessa disciplina gia` adottata per lo
  // sconto.
  it("update distingue «non toccare» da «azzera»", async () => {
    customerUpdate.mockResolvedValue({
      id: "c1",
      companyName: "MC",
      discount: null,
      kitGeometry: null,
      kitEntrata: null,
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));

    await caller.customer.update({ id: "c1", companyName: "MC" });
    expect(customerUpdate.mock.calls.at(-1)?.[0].data).not.toHaveProperty("kitGeometry");

    await caller.customer.update({ id: "c1", kitGeometry: null });
    expect(customerUpdate.mock.calls.at(-1)?.[0].data).toHaveProperty("kitGeometry", null);

    await caller.customer.update({ id: "c1", kitEntrata: "E75" });
    expect(customerUpdate.mock.calls.at(-1)?.[0].data).toHaveProperty("kitEntrata", "E75");
  });
});
