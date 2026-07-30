import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDiscountThreshold,
  setDiscountThreshold,
  SOGLIA_SCONTO_DEFAULT,
  type ThresholdDb,
} from "./discount-threshold";

const findUnique = vi.fn();
const upsert = vi.fn();
const activityCreate = vi.fn();

const db = {
  settings: { findUnique, upsert },
  activityLog: { create: activityCreate },
} as unknown as ThresholdDb;

beforeEach(() => {
  findUnique.mockReset();
  upsert.mockReset().mockResolvedValue({});
  activityCreate.mockReset().mockResolvedValue({});
});

describe("getDiscountThreshold", () => {
  it("legge il valore salvato", async () => {
    findUnique.mockResolvedValue({ value: 55 });
    await expect(getDiscountThreshold(db)).resolves.toBe(55);
  });

  it("senza riga vale il default", async () => {
    findUnique.mockResolvedValue(null);
    await expect(getDiscountThreshold(db)).resolves.toBe(SOGLIA_SCONTO_DEFAULT);
  });

  it("un valore corrotto a DB non diventa una soglia assurda", async () => {
    // `value` è Json: una stringa, un oggetto o un fuori-scala ci finiscono
    // dentro senza che il DB si lamenti. Meglio il default di una soglia che
    // non avvisa mai.
    for (const rotto of ["quaranta", { a: 1 }, -5, 101, null]) {
      findUnique.mockResolvedValue({ value: rotto });
      await expect(getDiscountThreshold(db)).resolves.toBe(SOGLIA_SCONTO_DEFAULT);
    }
  });

  it("legge la chiave giusta nella categoria giusta", async () => {
    findUnique.mockResolvedValue(null);
    await getDiscountThreshold(db);
    expect(findUnique).toHaveBeenCalledWith({
      where: { category_key: { category: "COMPANY_INFO", key: "DISCOUNT_WARN_THRESHOLD" } },
    });
  });
});

describe("setDiscountThreshold", () => {
  it("salva in chiaro, non cifrato", async () => {
    await setDiscountThreshold(db, 55, "admin1");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ value: 55, isEncrypted: false, updatedBy: "admin1" }),
        update: expect.objectContaining({ value: 55, isEncrypted: false, updatedBy: "admin1" }),
      }),
    );
  });

  it("lascia traccia nel registro attività", async () => {
    await setDiscountThreshold(db, 55, "admin1");
    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "admin1", type: "SETTINGS_CHANGED" }),
      }),
    );
  });

  it("restituisce la soglia salvata", async () => {
    await expect(setDiscountThreshold(db, 55, "admin1")).resolves.toBe(55);
  });
});
