import { describe, it, expect } from "vitest";
import { parseCategorie, parseDocumenti, confronta, type Indice } from "./vigilanza";

describe("parseCategorie", () => {
  it("legge id e titolo dai link dell'indice", () => {
    const html = `
      <li><a href="mostra.php?lang=en&catalogo=161"><span class="x">.</span> Vision 2026 catalogue</a></li>
      <li><a href="mostra.php?lang=en&catalogo=152"> RR catalogue 2026</a></li>`;
    expect(parseCategorie(html)).toEqual([
      { id: "161", titolo: ". Vision 2026 catalogue" },
      { id: "152", titolo: "RR catalogue 2026" },
    ]);
  });

  it("deduplica gli id: la stessa categoria può comparire due volte", () => {
    const html = `<a href="mostra.php?lang=en&catalogo=161">A</a>
                  <a href="mostra.php?lang=en&catalogo=161">A</a>`;
    expect(parseCategorie(html)).toHaveLength(1);
  });

  /**
   * Il caso che conta: su una pagina che non è l'indice non trova NIENTE, e il
   * chiamante deve trattare il vuoto come errore. Se un giorno COLOMBO rifà il
   * sito un'altra volta, è così che si presenta.
   */
  it("su una pagina che non è l'indice non trova niente", () => {
    expect(parseCategorie("<html><body>niente</body></html>")).toEqual([]);
  });
});

describe("parseDocumenti", () => {
  /**
   * Si prende QUALUNQUE file sotto /download/, non i soli PDF: se COLOMBO
   * ripubblicasse l'indice degli archivi fotografici, uno `.zip` comparirebbe
   * qui e il confronto lo direbbe da sé. È l'intento dello scraper che NON
   * abbiamo riscritto — la sua regex pretendeva gli apici singoli di un markup
   * che non esiste più — ottenuto senza lo scraper, e osservabile: questo codice
   * trova qualcosa tutte le settimane, quindi si sa che funziona.
   */
  it("prende qualunque file sotto /download/, non i soli PDF", () => {
    const html = `<a href="/download/maniglie/pdf/Vision2026.pdf">x</a>
                  <a href="/download/maniglie/archivio/01_Fedra.zip">y</a>
                  <a href="http://www.colombodesign.com/contatti/">z</a>`;
    expect(parseDocumenti(html)).toEqual([
      "/download/maniglie/archivio/01_Fedra.zip",
      "/download/maniglie/pdf/Vision2026.pdf",
    ]);
  });

  it("ordina e deduplica, così il confronto non dipende dall'ordine dell'HTML", () => {
    const html = `<a href="/download/b.pdf">b</a><a href="/download/a.pdf">a</a><a href="/download/b.pdf">b</a>`;
    expect(parseDocumenti(html)).toEqual(["/download/a.pdf", "/download/b.pdf"]);
  });
});

describe("confronta", () => {
  const atteso: Indice = {
    "161": { titolo: "Vision 2026 catalogue", file: ["/download/v.pdf"] },
    "152": { titolo: "RR catalogue 2026", file: ["/download/rr.pdf"] },
  };

  it("non dice niente quando combaciano", () => {
    expect(confronta({ ...atteso }, atteso)).toEqual([]);
  });

  it("nomina una categoria nuova", () => {
    const attuale = { ...atteso, "170": { titolo: "Vision 2027", file: ["/download/v27.pdf"] } };
    expect(confronta(attuale, atteso)).toEqual([
      "NUOVA categoria 170: «Vision 2027» → /download/v27.pdf",
    ]);
  });

  it("nomina una categoria sparita", () => {
    const { "152": _tolta, ...attuale } = atteso;
    expect(confronta(attuale, atteso)).toEqual(["SPARITA categoria 152: «RR catalogue 2026»"]);
  });

  /**
   * Il titolo che cambia È il segnale: «ER catalogue 2026» → «2027» è come
   * veniamo a sapere che esiste un'edizione nuova. Non si filtra.
   */
  it("nomina un titolo cambiato", () => {
    const attuale = {
      ...atteso,
      "152": { titolo: "RR catalogue 2027", file: ["/download/rr.pdf"] },
    };
    expect(confronta(attuale, atteso)).toEqual([
      "CAMBIATO titolo di 152: «RR catalogue 2026» → «RR catalogue 2027»",
    ]);
  });

  it("nomina i file cambiati, che è come si vede una ristampa", () => {
    const attuale = {
      ...atteso,
      "152": { titolo: "RR catalogue 2026", file: ["/download/rr2.pdf"] },
    };
    expect(confronta(attuale, atteso)).toEqual([
      "CAMBIATI i file di 152 «RR catalogue 2026»: /download/rr.pdf → /download/rr2.pdf",
    ]);
  });

  /**
   * ⚠️ Il caso che un `confronta` scritto male lascia passare: uno stato atteso
   * VUOTO deve produrre una riga per ogni categoria, non `[]`. È la stessa
   * forma del difetto che questa sessione corregge — un rilevatore che tace
   * mentre non guarda niente.
   */
  it("con uno stato atteso vuoto nomina tutto, invece di tacere", () => {
    expect(confronta(atteso, {})).toHaveLength(2);
  });
});
