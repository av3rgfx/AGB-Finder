import { describe, it, expect } from "vitest";
import { previewDiGruppo } from "./copertina";

/**
 * QUALE FOTO STA SULLA TESSERA DI UN GRUPPO, e quando non ce n'è nessuna.
 *
 * Il valore restituito decide anche la FORMA della tessera: `null` significa
 * «nessuna area immagine», non «riquadro vuoto». Fino al 2026-08-06 la forma
 * seguiva `isModello`, e i quattro gruppi di pomoli — modelli rimasti senza
 * foto dopo la PR #60 — mostravano il riquadro VUOTO: esattamente la cosa che
 * quella regola esisteva per impedire.
 */
describe("previewDiGruppo", () => {
  it("un gruppo-modello con foto usa quella di un suo articolo", () => {
    expect(previewDiGruppo("FEDRA", "maniglie/colombo/01-fedra/fedra-2cr")).toBe(
      "maniglie/colombo/01-fedra/fedra-2cr",
    );
  });

  it("un gruppo-modello senza foto di riga usa la copertina dichiarata", () => {
    // Il caso che questa funzione esiste per risolvere: CUT è un modello, e i
    // suoi undici codici hanno perso la foto perché nessuno prova la propria
    // finitura. Il gruppo però una faccia ce l'ha.
    expect(previewDiGruppo("CUT", null)).toBe("maniglie/colombo/02-pomoli/cut15-45");
    expect(previewDiGruppo("MILLA", null)).toBe("maniglie/colombo/01-milla-1/milla1-2crcm");
  });

  it("la foto di un articolo vince sulla copertina dichiarata", () => {
    // La copertina è un RIPIEGO: dove i codici hanno foto provate, la tessera
    // mostra il catalogo com'è oggi e non cambia faccia senza motivo.
    expect(previewDiGruppo("ROBOT", "maniglie/colombo/01-robot1-m/robot41-4nm")).toBe(
      "maniglie/colombo/01-robot1-m/robot41-4nm",
    );
  });

  it("una TIPOLOGIA non ha preview, nemmeno se un suo articolo ha una foto", () => {
    // Non è una svista: sarebbe l'ESEMPLARE, cioè un modello su 56 spacciato
    // per la categoria. Verdetto del council del 2026-08-06, contro la
    // maggioranza dei suoi advisor.
    expect(previewDiGruppo("MANIGLIONE", "maniglie/colombo/03-maniglioni-pulls/x")).toBeNull();
    expect(previewDiGruppo("MANIGLIA INCASSO", "maniglie/colombo/04-incasso/x")).toBeNull();
  });

  it("una tipologia senza niente non ha preview", () => {
    expect(previewDiGruppo("BOCCHETTA", null)).toBeNull();
    expect(previewDiGruppo("GRANO", null)).toBeNull();
  });

  it("un gruppo che non esiste non ha preview", () => {
    expect(previewDiGruppo("NON ESISTE", null)).toBeNull();
  });
});
