import { describe, it, expect } from "vitest";
import { normalizeArticleCode } from "./code-norm";

/**
 * La normalizzazione È la chiave di aggancio fra le tre fonti COLOMBO, che
 * scrivono lo stesso codice in tre modi diversi (misurato, non assunto):
 *   listino         `0CD41R-CM`   con separatori
 *   pronta consegna `0CD41RCM`    senza separatori
 *   catalogo        `SE 11 R-RY`  spaziato
 * Verificato sui 3.456 codici del listino: soli [A-Z0-9] maiuscoli produce
 * ZERO collisioni, quindi è una chiave sicura.
 */
describe("normalizeArticleCode", () => {
  it("toglie i separatori del listino", () => {
    expect(normalizeArticleCode("0CD41R-CM")).toBe("0CD41RCM");
  });

  it("toglie la barra", () => {
    expect(normalizeArticleCode("PB01/Q-CM")).toBe("PB01QCM");
  });

  it("toglie gli spazi della forma a catalogo", () => {
    expect(normalizeArticleCode("SE 11 R-RY")).toBe("SE11RRY");
    expect(normalizeArticleCode("ID 36")).toBe("ID36");
  });

  it("è il ponte fra le tre forme dello stesso codice", () => {
    const listino = normalizeArticleCode("0CD41R-CM");
    const magazzino = normalizeArticleCode("0CD41RCM");
    expect(listino).toBe(magazzino);
  });

  it("porta in maiuscolo", () => {
    expect(normalizeArticleCode("0cd41r-cm")).toBe("0CD41RCM");
  });

  it("tollera spazi in testa e in coda (celle Excel)", () => {
    expect(normalizeArticleCode("  0CD41R-CM \t")).toBe("0CD41RCM");
  });

  it("lascia intatto un codice già normale", () => {
    expect(normalizeArticleCode("XGRATZ7SX")).toBe("XGRATZ7SX");
  });

  it("scarta la punteggiatura residua invece di trattarla come carattere", () => {
    expect(normalizeArticleCode("0CD.63_FP*CM")).toBe("0CD63FPCM");
  });

  it("restituisce stringa vuota su input vuoto o solo separatori", () => {
    // Serve all'import: una cella vuota non deve diventare un codice fantasma
    // che si aggancia a un articolo qualsiasi.
    expect(normalizeArticleCode("")).toBe("");
    expect(normalizeArticleCode("   ")).toBe("");
    expect(normalizeArticleCode("---")).toBe("");
  });

  it("non confonde due codici diversi dei 23 orfani veri", () => {
    // 0CD63CM è il refuso di magazzino che ha DUE codici giusti (0CD63FP-CM e
    // 0CD63GB-CM): la normalizzazione non deve farlo collidere con nessuno dei
    // due, altrimenti si aggancerebbe in silenzio a quello sbagliato.
    expect(normalizeArticleCode("0CD63CM")).not.toBe(normalizeArticleCode("0CD63FP-CM"));
    expect(normalizeArticleCode("0CD63CM")).not.toBe(normalizeArticleCode("0CD63GB-CM"));
  });
});
