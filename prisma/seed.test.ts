import { describe, it, expect } from "vitest";
import { buildAdminUserData, BASE_CATEGORIES, CLIENTI_NOTI } from "./seed";
import { GEOMETRIE } from "../src/server/kit/artech-geometrie";

describe("buildAdminUserData", () => {
  it("marks the user ADMIN/ACTIVE, verified, with a composed name", () => {
    const data = buildAdminUserData("admin@x.it", "Anna", "Bianchi");
    expect(data).toMatchObject({
      email: "admin@x.it",
      name: "Anna Bianchi",
      firstName: "Anna",
      lastName: "Bianchi",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: true,
    });
  });

  it("does not carry a password (it lives in the Account row)", () => {
    expect(buildAdminUserData("a@b.it")).not.toHaveProperty("password");
  });
});

describe("BASE_CATEGORIES", () => {
  it("has unique slugs", () => {
    const slugs = BASE_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("CLIENTI_NOTI", () => {
  it("ha codici cliente unici (sono la chiave dell'upsert)", () => {
    const codici = CLIENTI_NOTI.map((c) => c.customerCode);
    expect(new Set(codici).size).toBe(codici.length);
  });

  // Data-driven sulla TABELLA delle geometrie, non su una lista ricopiata: se
  // un identificativo uscisse da `GEOMETRIE` il seed fallirebbe a runtime con un
  // errore di enum Postgres, che è il momento peggiore per accorgersene.
  it("ogni geometria dichiarata esiste in GEOMETRIE", () => {
    for (const c of CLIENTI_NOTI) {
      expect(Object.keys(GEOMETRIE)).toContain(c.kitGeometry);
    }
  });

  it("sono i tre clienti principali, con la geometria detta dall'agente", () => {
    expect(CLIENTI_NOTI).toEqual([
      expect.objectContaining({ companyName: "MC", kitGeometry: "A4_I85_B15" }),
      expect.objectContaining({ companyName: "Peruzzi", kitGeometry: "A4_I9_B18" }),
      expect.objectContaining({ companyName: "Fosca", kitGeometry: "A12_I13_B18" }),
    ]);
  });

  // NON dichiarano entrata né sconto, ed è una scelta, non una dimenticanza:
  // l'entrata è la domanda 17, ancora aperta. Scriverne una inventata nel
  // profilo di un cliente vero sarebbe esattamente il difetto che la #44 ha
  // appena chiuso, in un posto più difficile da vedere.
  it("non dichiarano entrata ne` sconto: non li sappiamo", () => {
    for (const c of CLIENTI_NOTI) {
      expect(c).not.toHaveProperty("kitEntrata");
      expect(c).not.toHaveProperty("discount");
    }
  });
});
