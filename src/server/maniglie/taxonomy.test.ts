import { describe, it, expect } from "vitest";
import { firstWord, secondToken, familyTokenIndex, familyOf, SQL_FIRST_WORD } from "./taxonomy";

describe("firstWord", () => {
  it("prende la prima parola e la porta in maiuscolo", () => {
    expect(firstWord("Maniglia CD41 cromo")).toBe("MANIGLIA");
  });

  it("collassa gli spazi multipli, come dovrà fare il suo gemello SQL", () => {
    // 45 descrizioni del listino vero hanno lo spazio doppio: `PEGASO  INCASSO`.
    expect(firstWord("  MANIGLIA   CD41  ")).toBe("MANIGLIA");
  });

  it("regge una descrizione di una parola sola", () => {
    expect(firstWord("POMOLO")).toBe("POMOLO");
  });

  it("su una descrizione vuota restituisce stringa vuota, non esplode", () => {
    expect(firstWord("   ")).toBe("");
  });
});

describe("SQL_FIRST_WORD", () => {
  it("collassa gli spazi prima di dividere, o lo spazio doppio darebbe stringa vuota", () => {
    expect(SQL_FIRST_WORD).toContain("regexp_replace");
    expect(SQL_FIRST_WORD).toContain("split_part");
  });
});

describe("secondToken", () => {
  it("prende il secondo token", () => {
    expect(secondToken("MANIGLIA CD41 CROMO SATINATO")).toBe("CD41");
  });

  it("è null quando la descrizione ha una parola sola", () => {
    expect(secondToken("POMOLO")).toBeNull();
  });
});

describe("familyTokenIndex", () => {
  // Il listino vero non mette la famiglia sempre al secondo posto: la posizione
  // dipende da quante parole di nome commerciale la precedono. Ma il CODICE dice
  // quale token sia — non si deduce una grammatica, si intersecano due campi che
  // COLOMBO ha scritto entrambi.
  it("trova la famiglia al secondo posto", () => {
    expect(familyTokenIndex("FEDRA AC11R CROMAT", "0AC11RCM")).toBe(1);
  });

  it("la trova al terzo, quando il nome commerciale è di due parole", () => {
    expect(familyTokenIndex("PLACCA PEGASO PL70 CROMAT", "0AM11PL70CM")).toBe(2);
  });

  it("la trova al quarto", () => {
    expect(familyTokenIndex("PLACCA Y PER AM113 BRONZO", "0AM113PLYBR")).toBe(3);
  });

  it("è null quando nessun token compare nel codice", () => {
    // La descrizione dice AC11RY, il codice dice AC11RSMY: sono davvero diversi.
    expect(familyTokenIndex("FEDRA AC11RY STRETTA C/MOLLA", "0AC11RSMYCM")).toBeNull();
  });

  it("ignora i token di un carattere, che aggancerebbero per caso", () => {
    expect(familyTokenIndex("PLACCA Y CROMO", "0AM113PLYBR")).toBeNull();
  });
});

describe("familyOf", () => {
  it("restituisce la parola, non l'indice", () => {
    expect(familyOf("PLACCA PEGASO PL70 CROMAT", "0AM11PL70CM")).toBe("PL70");
  });

  it("è null quando nessun token aggancia il codice", () => {
    // Riga vera del listino: gli accessori una famiglia non ce l'hanno, e
    // l'assenza va restituita invece di ripiegare sulla prima parola.
    expect(familyOf("KIT PORTE SCORREVOLI", "0CC211BZGC01")).toBeNull();
  });
});
