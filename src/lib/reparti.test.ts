import { describe, it, expect } from "vitest";
import { REPARTI, repartoDaPathname, repartoDaSlug, HOME_REPARTI } from "./reparti";

describe("repartoDaPathname", () => {
  it("le rotte senza prefisso sono il reparto storico", () => {
    // È l'asimmetria dichiarata: «le finestre non si toccano» alla lettera.
    for (const p of ["/dashboard", "/archivio", "/richieste", "/clienti", "/assistente"]) {
      expect(repartoDaPathname(p)?.slug).toBe("serramenti");
    }
  });

  it("le rotte sotto /maniglie sono il reparto maniglie", () => {
    expect(repartoDaPathname("/maniglie")?.slug).toBe("maniglie");
    expect(repartoDaPathname("/maniglie/abc123")?.slug).toBe("maniglie");
    expect(repartoDaPathname("/maniglie/import")?.slug).toBe("maniglie");
  });

  it("NON scambia una rotta che comincia per «maniglie» ma è un'altra cosa", () => {
    // `/manigliette` non è dentro `/maniglie`: il confine è il segmento, non il
    // prefisso di stringa. Senza questo, una rotta futura finirebbe in silenzio
    // nel reparto sbagliato, con la sidebar sbagliata.
    expect(repartoDaPathname("/manigliette")?.slug).toBe("serramenti");
  });

  it("sulla schermata di scelta non si è in nessun reparto", () => {
    expect(repartoDaPathname(HOME_REPARTI)).toBeNull();
  });

  it("le sezioni admin trasversali restano nel reparto storico", () => {
    // `/utenti` e `/impostazioni` non appartengono a nessuno dei due mondi.
    // Sono raggiungibili da ENTRAMBE le sidebar (un link duplicato non è una
    // pagina duplicata), ma il pathname deve pur risolversi a qualcosa.
    expect(repartoDaPathname("/utenti")?.slug).toBe("serramenti");
    expect(repartoDaPathname("/impostazioni")?.slug).toBe("serramenti");
  });
});

describe("REPARTI", () => {
  it("ogni reparto ha una home raggiungibile e distinta", () => {
    // SENTINELLA: se un reparto entra nella lista senza una home, la schermata
    // di scelta mostrerebbe una tessera che non porta da nessuna parte — cioè
    // il «sembra un guasto» che il council voleva evitare. Questo test fallisce
    // col nome del reparto colpevole.
    const homes = new Set<string>();
    for (const r of REPARTI) {
      expect(r.home, `il reparto ${r.slug} non ha una home`).toMatch(/^\//);
      expect(homes.has(r.home), `il reparto ${r.slug} ha una home duplicata`).toBe(false);
      homes.add(r.home);
    }
  });

  it("la home di ogni reparto ricade nel reparto stesso", () => {
    // Se la home di «maniglie» fosse `/dashboard`, sceglierlo porterebbe nella
    // sidebar dei serramenti: il distacco si romperebbe al primo clic.
    for (const r of REPARTI) {
      expect(repartoDaPathname(r.home)?.slug, `home sbagliata per ${r.slug}`).toBe(r.slug);
    }
  });

  it("ogni reparto dichiara le sezioni che contiene", () => {
    // Le tessere le mostrano perché chi entra la prima volta non debba provarle
    // entrambe per capire dove andare.
    for (const r of REPARTI) {
      expect(r.sezioni.length, `il reparto ${r.slug} non elenca sezioni`).toBeGreaterThan(0);
    }
  });

  it("ogni reparto dichiara almeno una marca", () => {
    // Il marchio vive nel sottotitolo: è ciò che disambigua «maniglie», visto
    // che AGB vende maniglie a sua volta (la cremonese è la maniglia della
    // finestra). Senza marca, la tessera è ambigua.
    for (const r of REPARTI) {
      expect(r.marchi.length, `il reparto ${r.slug} non dichiara marche`).toBeGreaterThan(0);
    }
  });

  it("gli slug sono univoci", () => {
    expect(new Set(REPARTI.map((r) => r.slug)).size).toBe(REPARTI.length);
  });
});

describe("repartoDaSlug", () => {
  it("trova un reparto esistente", () => {
    expect(repartoDaSlug("maniglie")?.nome).toBe("MANIGLIE");
  });
  it("restituisce null su uno slug sconosciuto", () => {
    expect(repartoDaSlug("inesistente")).toBeNull();
  });
});
