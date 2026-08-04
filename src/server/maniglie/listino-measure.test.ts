import { describe, it, expect } from "vitest";
import {
  codeTail,
  median,
  measureListino,
  type MeasuredArticle,
} from "./listino-measure";

const a = (code: string, name: string): MeasuredArticle => ({
  code,
  codeNorm: code.toUpperCase().replace(/[^A-Z0-9]/g, ""),
  name,
});

describe("codeTail", () => {
  it("prende la coda dopo l'ultimo separatore", () => {
    expect(codeTail("0CD41R-CM")).toBe("CM");
  });

  it("segue l'ULTIMO separatore, non il primo", () => {
    expect(codeTail("PB01/Q-CM")).toBe("CM");
  });

  it("è null quando il codice non ha separatori: la coda non esiste, non è vuota", () => {
    expect(codeTail("0CD41RCB")).toBeNull();
  });

  it("è null quando il separatore è l'ultimo carattere", () => {
    expect(codeTail("0CD41R-")).toBeNull();
  });
});

describe("median", () => {
  it("su un numero dispari di valori prende quello centrale", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("su un numero pari fa la media dei due centrali", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("su un elenco vuoto è 0", () => {
    expect(median([])).toBe(0);
  });
});

describe("measureListino", () => {
  // Le venti righe del seed sono INVENTATE, ma la loro forma è quella misurata
  // sui file veri: qui servono solo a provare che le misure contino, non a dire
  // qualcosa sul listino COLOMBO.
  const sample: MeasuredArticle[] = [
    a("0CD41R-CM", "MANIGLIA CD41 CROMO SATINATO"),
    a("0CD41R-OL", "MANIGLIA CD41 OTTONE LUCIDO"),
    a("0CD41R-NM", "MANIGLIA CD41 NERO OPACO"),
    a("0CD63FP-CM", "BOCCHETTA CD63 FORO PATENT CROMO"),
    a("0CD63GB-CM", "BOCCHETTA CD63 FORO YALE CROMO"),
    a("0CD41RCB", "BOCCEHTTA CD41 CROMO BIANCO"),
    a("LC55-VT", "VITE FISSAGGIO ROSETTA M4X22"),
  ];

  const m = measureListino(sample);

  it("conta le righe misurate", () => {
    expect(m.total).toBe(7);
  });

  describe("(a) prime parole", () => {
    it("conta le prime parole distinte", () => {
      // MANIGLIA · BOCCHETTA · BOCCEHTTA · VITE
      expect(m.firstWords.distinct).toBe(4);
    });

    it("ordina i gruppi per frequenza decrescente", () => {
      expect(m.firstWords.groups.map((g) => g.word)).toEqual([
        "MANIGLIA",
        "BOCCHETTA",
        "BOCCEHTTA",
        "VITE",
      ]);
      expect(m.firstWords.groups[0]!.count).toBe(3);
    });

    it("porta con sé un esempio per gruppo, per poterlo guardare a occhio", () => {
      expect(m.firstWords.groups[0]!.examples[0]).toBe("MANIGLIA CD41 CROMO SATINATO");
    });

    it("conta i singoletti: è lì che si annidano refusi e nomi di modello", () => {
      // BOCCEHTTA (refuso) e VITE
      expect(m.firstWords.singletons).toBe(2);
    });

    it("dice quante parole coprono il 95% dei codici", () => {
      // 3+2 = 5 su 7 = 71%; +1 = 6 su 7 = 86%; +1 = 7 su 7 = 100% ≥ 95%
      expect(m.firstWords.wordsFor95).toBe(4);
    });

    it("segnala le descrizioni con spaziatura irregolare", () => {
      const irregolare = measureListino([a("X1", "MANIGLIA  CD41 CROMO")]);
      expect(irregolare.firstWords.irregularWhitespace).toBe(1);
      expect(m.firstWords.irregularWhitespace).toBe(0);
    });
  });

  describe("(b) il secondo token è la famiglia del codice?", () => {
    it("conta i codici in cui il secondo token compare nel codice normalizzato", () => {
      // 6 su 7: solo VITE («FISSAGGIO» non è in LC55VT) non aggancia.
      expect(m.secondTokenIsFamily.matched).toBe(6);
      expect(m.secondTokenIsFamily.ratio).toBeCloseTo(6 / 7, 5);
    });

    it("elenca i controesempi, perché è lì che si vede se la strada regge", () => {
      expect(m.secondTokenIsFamily.counterExamples).toHaveLength(1);
      expect(m.secondTokenIsFamily.counterExamples[0]).toMatchObject({
        code: "LC55-VT",
        token: "FISSAGGIO",
      });
    });

    it("scompone il rapporto per prima parola", () => {
      // Un numero unico mescola le maniglie (che una famiglia ce l'hanno) con gli
      // accessori (che non ce l'hanno): sono due risposte diverse a due domande
      // diverse, e per lo sfoglio conta solo la prima.
      const perWord = new Map(m.secondTokenIsFamily.byFirstWord.map((r) => [r.word, r]));
      expect(perWord.get("MANIGLIA")).toMatchObject({ total: 3, matched: 3, ratio: 1 });
      expect(perWord.get("VITE")).toMatchObject({ total: 1, matched: 0, ratio: 0 });
    });

    it("ordina la scomposizione per numerosità, come i gruppi", () => {
      expect(m.secondTokenIsFamily.byFirstWord[0]!.word).toBe("MANIGLIA");
    });

    it("aggancia anche quando la PRIMA parola non è una tipologia", () => {
      // `ROBOCINQUQ CB16 OTTONE` è un nome di modello con refuso, ma CB16 è
      // comunque la famiglia: le misure (a) e (b) sono indipendenti.
      const solo = measureListino([a("CB16ZB-OT", "ROBOCINQUQ CB16 OTTONE")]);
      expect(solo.secondTokenIsFamily.matched).toBe(1);
    });
  });

  describe("(b bis) la famiglia, ovunque stia nella descrizione", () => {
    it("conta quanti codici hanno un token che compare nel codice", () => {
      // Tutti tranne VITE («FISSAGGIO», «ROSETTA», «M4X22» non sono in LC55VT).
      expect(m.familyToken.found).toBe(6);
      expect(m.familyToken.ratio).toBeCloseTo(6 / 7, 5);
    });

    it("dice in che posizione si trova, perché è ciò che decide se serve una regola posizionale", () => {
      // Qui è sempre il secondo token (indice 1).
      expect(m.familyToken.positions).toEqual([{ index: 1, count: 6 }]);
    });
  });

  describe("(c) e (d) famiglie", () => {
    it("conta le famiglie distinte fra i soli secondi token agganciati", () => {
      // CD41 (3 maniglie + 1 bocchetta refuso) · CD63 (2)
      expect(m.families.distinct).toBe(2);
    });

    it("dà la mediana dei codici per famiglia", () => {
      // CD41 → 4 codici, CD63 → 2 codici; mediana di [2,4] = 3
      expect(m.families.medianCodes).toBe(3);
    });

    it("dà anche la famiglia più popolosa, per vedere il caso peggiore a schermo", () => {
      expect(m.families.largest).toMatchObject({ word: "CD41", count: 4 });
    });
  });

  describe("(e) coda dopo l'ultimo separatore", () => {
    it("conta solo i codici che un separatore ce l'hanno", () => {
      // Tutti tranne 0CD41RCB
      expect(m.tails.withSeparator).toBe(6);
    });

    it("conta le code distinte", () => {
      // CM · OL · NM · VT
      expect(m.tails.distinct).toBe(4);
    });

    it("ordina anche le code per frequenza", () => {
      expect(m.tails.groups[0]).toMatchObject({ word: "CM", count: 3 });
    });
  });

  it("su un listino vuoto restituisce zeri invece di dividere per zero", () => {
    const vuoto = measureListino([]);
    expect(vuoto.total).toBe(0);
    expect(vuoto.firstWords.distinct).toBe(0);
    expect(vuoto.firstWords.wordsFor95).toBe(0);
    expect(vuoto.secondTokenIsFamily.ratio).toBe(0);
    expect(vuoto.families.medianCodes).toBe(0);
  });
});
