// Regole kit ARTECH «vasistas» LEGNO.
// PROVVISORIO (da validare con l'esperto AGB): la distinta è la TRASCRIZIONE
// delle 13 voci dello schema di montaggio p0418 (416) «Finestra rettangolare
// legno - apertura vasistas», anta singola, entrata E.15, variante base, per la
// geometria `A12_I13_B20` (aria 12 / interasse 13 / battuta 20) — l'UNICA che
// questo modulo copre, anche dopo il cutover del 2026-07-29 che ne ha aperte
// sette all'anta-ribalta. Vedi GEOMETRIA_COPERTA più sotto per il perché.
//
// ⚠️ Numerazione: nel listino la pagina FISICA del PDF è la stampata + 2, e qui
// si cita sempre «fisica (stampata)». Il commento precedente diceva «pag.416»
// intendendo la stampata, cioè la fisica p0418: ma la fisica 416 è lo schema del
// BATTENTE, un'altra tipologia due pagine prima. La fonte del vasistas è p0418.
//
// Riscritto il 2026-07-25: prima la distinta conteneva DSS A50190.00.00 e
// incontro DSS A51400.05.03, che lo schema vasistas NON prevede (venivano da una
// NB della tabella cremonesi scritta per l'uso ANTA-RIBALTA della famiglia
// condivisa), e non conteneva NESSUNA cerniera (voci 10-11-12): l'anta non era
// appesa. Le voci non derivabili con certezza restano marcate ASSUNZIONE. Vedi
// docs/superpowers/kit-assunzioni/vasistas.md.
//
// ⚠️ COPERTURA: 12 delle 13 voci dello schema. La voce 7 («Chiusure
// supplementari › terminale», i due terminali sui montanti) è OMESSA DI
// PROPOSITO — vedi il blocco «Voce 7» più sotto.
//
// La distinta NON dipende da `openingSide`: una ribalta pura è incernierata in
// basso e non ha una mano. Le uniche varianti di mano sono le due articolazioni
// superiori dei due angoli inferiori, speculari → 1 DX + 1 SX (vedi sotto).
import { pick } from "./kit-shared";
import { MOVIMENTO_ANGOLARE } from "./artech-legno-shared";
import { geometria, assertSeatConfigSupportata, mm } from "./artech-geometrie";
import {
  KitGenerationError,
  asArtech,
  type KitInput,
  type KitLine,
  type RuleModule,
} from "./types";

/**
 * L'UNICA geometria per cui questo modulo ha dati: quella su cui è trascritto lo
 * schema p0418 (416).
 *
 * PERCHÉ IL VASISTAS NON APRE LE 7 GEOMETRIE INSIEME ALL'ANTA-RIBALTA. L'apertura
 * è possibile solo dove esiste una tabella di codici per geometria, e per il
 * vasistas non c'è: le sue voci geometria-dipendenti sono cablate a mano —
 * cerniere `A51101.36.01` e `A51001.36.0N` (il `.36` **è** interasse 13/battuta
 * 20), supporto forbice `A50702.05.00` (aria 12/battuta 20), incontro nottolino
 * `A51400.05.02` (aria 12, formato 9x18). Su un'altra geometria almeno tre di
 * queste quattro sono sbagliate: A12_I9_B18 vuole `.24` e `A50701.05.00`,
 * A12_I13_B18 vuole `.34` e l'incontro `A51400.CR.13`.
 *
 * Accettare le altre arie-12 «perché lo schema è dell'aria 12» produrrebbe quindi
 * distinte plausibili e sbagliate — lo stesso difetto che ha fatto disattivare
 * PVC e battente, e che `assertPilotGeometry` (rimossa oggi) qui impediva. Il
 * perimetro resta perciò IDENTICO a prima del cutover: si allarga solo dove ci
 * sono i dati. Si riapre quando le tre famiglie di cerniere del vasistas saranno
 * trascritte per geometria, come è stato fatto per l'anta-ribalta.
 */
const GEOMETRIA_COPERTA = "A12_I13_B20";

/**
 * Cremonese vasistas «maniglia variabile/centrale» A50111.15.NN (E.15) per GR,
 * GR scelto per altezza (HBB). Colonne dalla tabella listino (righe 19552-19558):
 * codice + nNottolini (colonna NOT.). Campo pilota GR01-GR06 (HBB 540-2510);
 * GR00 resta fuori dal campo pilota (banda HBB e colonna NOT. non trascritte).
 * ASSUNZIONE: HBB = heightMm (offset 0, come il battente; l'anta-ribalta usa
 * -10). I bordi sovrapposti si risolvono con lo span più stretto in pick()
 * (= GR più basso).
 */
const VASISTAS_CREMONESI = [
  { minH: 540, maxH: 712, gr: 1, code: "A50111.15.11", nottolini: 0 },
  { minH: 660, maxH: 860, gr: 2, code: "A50111.15.12", nottolini: 1 },
  { minH: 820, maxH: 1220, gr: 3, code: "A50111.15.13", nottolini: 1 },
  { minH: 1190, maxH: 1610, gr: 4, code: "A50111.15.14", nottolini: 2 },
  { minH: 1590, maxH: 2010, gr: 5, code: "A50111.15.15", nottolini: 2 },
  { minH: 1890, maxH: 2510, gr: 6, code: "A50111.15.16", nottolini: 4 },
] as const;

/**
 * Numero di forbici per banda di LARGHEZZA (LBB), dalla tabella grafica
 * «Posizionamento forbici» stampata sullo schema p0418 (416). Prima il modulo lo
 * derivava dal GR del cremonese, cioè dall'ALTEZZA: sbagliato su ogni larghezza
 * diversa da quella del golden.
 * NB dello schema: «per ragioni di sicurezza le forbici sui montanti sono
 * obbligatorie per LBB compresi tra 861 e 2510 (per HBB > 500 mm)» — è la ragione
 * per cui il conteggio sale a 3 e 4.
 * Articolo unico A50545.00.00 (p0442 (440), «Per Vasistas › per cremonese
 * maniglia variabile»): il listino non distingue le forbici del traverso da
 * quelle dei montanti, cambia solo la posizione di montaggio.
 */
const VASISTAS_FORBICI = [
  { minL: 274, maxL: 540, forbici: 2, posizione: "2 sui montanti" },
  { minL: 541, maxL: 860, forbici: 1, posizione: "1 sul traverso" },
  { minL: 861, maxL: 1200, forbici: 3, posizione: "1 sul traverso + 2 sui montanti" },
  { minL: 1201, maxL: 2510, forbici: 4, posizione: "2 sul traverso + 2 sui montanti" },
] as const;

/**
 * Cerniere dello schema p0418 (416), voci 10-11-12: sono ciò che APPENDE l'anta
 * vasistas, per la geometria del pilota (interasse 13 / battuta 20 → suffisso
 * .36). Quantità 2 per famiglia: il disegno è l'esploso di UNA anta singola
 * (traverso superiore con i terminali ③ e ④ alle due estremità e la cremonese ①
 * al centro, due montanti, lato inferiore) e ai DUE ANGOLI INFERIORI, speculari,
 * compaiono ⑩+⑪+⑫ ciascuno col suo ⑧ supporto forbice e ⑨ perno.
 *
 * ⚠️ Lettura OPPOSTA della Fase 1i, superata qui con l'evidenza dello schema.
 * `docs/superpowers/specs/2026-07-23-fase1i-kit-vasistas-legno-design.md` le
 * escludeva: «Cerniere per seconda anta (pos. 10-12, solo anta doppia/semifissa)».
 * La legenda di p0418 (416) le prefissa davvero così — verificato sul PDF:
 *   «10 Cerniere per seconda anta » Centrale registrabile portante»
 *   «11 Cerniere per seconda anta » Articolazione superiore anta semifissa»
 *   «12 Cerniere per seconda anta » Corpo articolazione superiore»
 * ma «Cerniere per seconda anta - Legno» è il TITOLO DELLA SEZIONE di listino da
 * cui le voci sono citate (p0453 (451)-p0455 (453)), non la loro destinazione: la
 * legenda nomina sempre «sezione » articolo», come per «Cremonesi » Anta
 * ribalta/Vasistas» alla voce 1. Nel disegno stanno sull'unica anta presente.
 * Conferma indipendente: l'NB ▲ «Con ante di peso compreso tra i 70 e gli 80 Kg
 * (max) aggiungere la cerniera al centro ⑩», con la ⑩ in più disegnata al centro
 * del lato inferiore di QUESTA anta — la cerniera di un'altra anta non si
 * aggiunge al centro di questa in funzione del peso di questa.
 *
 * ASSUNZIONE residua su tutte e tre — la VARIANTE, non la famiglia: il listino
 * offre per ciascuna una «base» e un'alternativa che lo schema non discrimina —
 *   · voce 10: A51101.36.01 «regolabile in 2 dimensioni» (scelta) vs A51102.36.02
 *     «con compensatore 16/12, regolabile in 3 dimensioni», p0455 (453);
 *   · voce 11: A51001.36.NN (scelta) vs A51002.36.NN «con canale 16/12»,
 *     p0454 (452)-p0455 (453);
 *   · voce 12: A51050.16.12 (scelta) vs A51051.16.12 «solo lato traverso superiore».
 * Domanda 5 per l'esperto in docs/superpowers/kit-assunzioni/vasistas.md.
 *
 * NB: la voce 10 è l'unica famiglia che il listino chiama esplicitamente «e PER
 * VASISTAS» — conferma che la scelta di famiglia è corretta.
 */
const CERNIERA_PORTANTE = "A51101.36.01"; // ambidestra: il listino non dà varianti di mano
const CORPO_ARTICOLAZIONE = "A51050.16.12"; // senza mano a listino (p0454 (452))

/**
 * Voce 11, p0455 (453): è l'UNICA delle tre che il listino dà per mano (colonna
 * MANO: dx `A51001.36.01`, sx `A51001.36.02`). I due angoli inferiori del disegno
 * sono speculari → serve una articolazione per mano, 1 pezzo ciascuna.
 *
 * NON dipende da `openingSide`: il vasistas è incernierato in basso e non ha una
 * mano (il campo resta nel form perché è generico del kit engine). Prima di
 * questa correzione il modulo emetteva 2 pezzi della STESSA mano scelti su
 * `openingSide` — un dato privo di significato per la tipologia che cambiava in
 * silenzio la ferramenta consegnata, e per giunta lasciava un angolo senza la sua
 * articolazione.
 */
const ARTICOLAZIONE_SUPERIORE = [
  { position: "articolazione-superiore-dx", code: "A51001.36.01", montante: "destro" },
  { position: "articolazione-superiore-sx", code: "A51001.36.02", montante: "sinistro" },
] as const;

/** Cerniere portanti dello schema: 2, una per angolo inferiore. */
const N_CERNIERE_PORTANTI = 2;

/**
 * Le due NB dello schema p0418 (416) che dipendono dal PESO dell'anta:
 *  · «▲ Con ante di peso compreso tra i 70 e gli 80 Kg (max) aggiungere la
 *    cerniera al centro ⑩» → una terza cerniera portante, col suo supporto
 *    forbice ⑧ e il suo perno ⑨; oltre gli 80 kg si è fuori campo. Le voci 11 e
 *    12 NON seguono: restano ai due angoli inferiori (l'NB aggiunge la sola ⑩).
 *  · «La portata massima per le forbici di sicurezza è di 40 Kg cadauna» → il
 *    peso non può superare 40 kg × n. forbici, e le forbici dipendono dalla
 *    LARGHEZZA (VASISTAS_FORBICI): a L 600 c'è una sola forbice, cioè 40 kg.
 * Entrambe sono verificabili solo se l'agente ha indicato il peso: `sashWeightKg`
 * è opzionale e quando manca il modulo dichiara nella riga di distinta il limite
 * di peso di QUELLA distinta anziché tacere. Il limite è il MINORE fra le due NB
 * — `min(70, 40 × n. forbici)` — perché entrambe mordono: a L 600 la distinta ha
 * una sola forbice, quindi vale fino a 40 kg, non a 70.
 */
const PORTATA_FORBICE_KG = 40;
const PESO_TERZA_CERNIERA_KG = 70;
const PESO_MAX_KG = 80;

/** Movimenti angolari per il vasistas base (ASSUNZIONE: 2, come i moduli gemelli). */
const N_MOVIMENTI = 2;

export const artechVasistasLegno: RuleModule = {
  engineId: "artech-vasistas-legno",
  generate(rawInput: KitInput): KitLine[] {
    // Restringe al ramo ARTECH dell'unione: il corpo sotto è invariato.
    const input = asArtech(rawInput);
    if (input.material !== "LEGNO")
      throw new KitGenerationError(
        `Materiale "${input.material}" non ancora coperto per la vasistas: il generatore supporta LEGNO.`,
        "artech.materiale",
      );

    // Guardia geometria: vedi GEOMETRIA_COPERTA. Le voci geometria-dipendenti di
    // questo modulo sono cablate, non tabellate — fuori da quella riga il modulo
    // emetterebbe la ferramenta di un'altra finestra.
    assertSeatConfigSupportata(input.seatConfig);
    const geo = geometria(input.geometry);
    if (input.geometry !== GEOMETRIA_COPERTA)
      throw new KitGenerationError(
        `Geometria «aria ${geo.airGapMm} / interasse ${mm(geo.axisOffsetMm)} / battuta ${geo.rebateMm}» ` +
          `non coperta per la vasistas: lo schema p0418 (416) è trascritto per la sola aria 12 / ` +
          `interasse 13 / battuta 20, e le cerniere del vasistas non sono ancora tabellate per ` +
          `geometria. L'anta-ribalta le copre tutte e sette.`,
        "artech.vasistas.geometria",
      );

    // Guardia superficie ≤ 2 m² (limite stampato sullo schema p0418 (416)).
    const areaM2 = (input.widthMm * input.heightMm) / 1_000_000;
    if (areaM2 > 2)
      throw new KitGenerationError(
        `Superficie ${areaM2.toFixed(2)} m² oltre il massimo di 2 m² per la vasistas.`,
        "artech.superficie",
      );

    const gr = pick(
      VASISTAS_CREMONESI,
      input.heightMm,
      "H",
      "artech.cremonese",
      "cremonese vasistas",
    );
    const banda = pick(
      VASISTAS_FORBICI,
      input.widthMm,
      "L",
      "artech.forbici",
      "posizionamento forbici vasistas",
    );
    const nForbici = banda.forbici;

    // NB dello schema: «la portata massima per le forbici di sicurezza è di 40 kg
    // cadauna». Verificabile solo se l'agente ha indicato il peso.
    const portataKg = nForbici * PORTATA_FORBICE_KG;
    if (input.sashWeightKg !== undefined && input.sashWeightKg > portataKg)
      throw new KitGenerationError(
        `Anta da ${input.sashWeightKg} kg oltre la portata delle forbici: ${nForbici} × ${PORTATA_FORBICE_KG} kg = ` +
          `${portataKg} kg massimi per una larghezza di ${input.widthMm} mm.`,
        "artech.forbici",
      );

    // NB dello schema: «con ante di peso compreso tra i 70 e gli 80 kg (max)
    // aggiungere la cerniera al centro ⑩». Oltre gli 80 kg si è fuori campo.
    if (input.sashWeightKg !== undefined && input.sashWeightKg > PESO_MAX_KG)
      throw new KitGenerationError(
        `Anta da ${input.sashWeightKg} kg oltre il massimo di ${PESO_MAX_KG} kg previsto dallo schema vasistas.`,
        "artech.peso",
      );
    const nCerniere =
      input.sashWeightKg !== undefined && input.sashWeightKg >= PESO_TERZA_CERNIERA_KG
        ? N_CERNIERE_PORTANTI + 1
        : N_CERNIERE_PORTANTI;

    const lines: KitLine[] = [];

    // 1) Cremonese vasistas (maniglia variabile) — per GR/altezza.
    lines.push({
      position: "cremonese",
      code: gr.code,
      quantity: 1,
      ruleId: "artech.cremonese",
      ruleDescription: `Cremonese vasistas maniglia variabile GR0${gr.gr} per altezza ${input.heightMm} mm`,
    });

    // 2) Forbici per vasistas — tabella «Posizionamento forbici» per LBB.
    lines.push({
      position: "forbici-vasistas",
      code: "A50545.00.00",
      quantity: nForbici,
      ruleId: "artech.forbici",
      ruleDescription: `Forbici per vasistas — LBB ${banda.minL}-${banda.maxL}: ${banda.posizione}`,
    });

    // 3-4) I due terminali per vasistas alle estremità opposte del traverso.
    lines.push(
      {
        position: "terminale-vasistas-18",
        code: "A50193.00.03",
        quantity: 1,
        ruleId: "artech.terminale",
        ruleDescription: "Terminale per vasistas con nottolino corsa 18",
      },
      {
        position: "terminale-vasistas-18-18",
        code: "A50193.00.02",
        quantity: 1,
        ruleId: "artech.terminale",
        ruleDescription: "Terminale per vasistas con nottolino corsa 18+18",
      },
    );

    // 7) «Chiusure supplementari › terminale» (i due terminali sui montanti):
    // VOCE OMESSA DI PROPOSITO, non dimenticata. Lo schema la disegna ma non
    // pubblica NÉ il codice NÉ la lunghezza, e la lunghezza è l'intero problema:
    // il terminale si compone con l'altezza del montante (angolare + prolunghe +
    // terminale), e a listino esistono terminali/prolunghe da 200/400/600/800.
    // L'unica regola di composizione che conosciamo — CHIUSURE_VERTICALI in
    // rules-artech-legno.ts — copre una sola banda (H 1520-2120) ed è nota
    // perché ricavata da una distinta ANTA-RIBALTA reale del 2021: per il
    // vasistas quella distinta non esiste. Emettere qui un codice scelto per
    // analogia significherebbe stampare una lunghezza inventata su una distinta
    // d'ordine — esattamente la classe di errore che questa bonifica elimina.
    // Meglio una distinta incompleta e dichiarata che una completa e sbagliata.
    // Sbloccata dalla domanda «terminale sui montanti» in
    // docs/superpowers/kit-assunzioni/vasistas.md.
    //
    // Di conseguenza il modulo IGNORA `input.supplementaryClosures`: il flag non
    // ha righe da accendere per questa tipologia (coerente col wizard, che per
    // VASISTAS non mostra la casella e forza il campo a false).

    // 8-9) Supporto forbice + perno: nel disegno stanno sotto le CERNIERE
    // portanti, non sotto le forbici (prima erano legati a n. forbici).
    lines.push(
      {
        position: "supporto-forbice",
        code: "A50702.05.00",
        quantity: nCerniere,
        ruleId: "artech.cerniere",
        ruleDescription: `Supporto forbice legno battuta ${geo.rebateMm} = n. cerniere portanti (${nCerniere})`,
      },
      {
        position: "perno-supporto-forbice",
        code: "A50790.00.00",
        quantity: nCerniere,
        ruleId: "artech.cerniere",
        ruleDescription: `Perno per supporto forbice = n. cerniere portanti (${nCerniere})`,
      },
    );

    // 10-11-12) Cerniere dello schema: portante + articolazione superiore + corpo.
    lines.push(
      {
        position: "cerniera-portante",
        code: CERNIERA_PORTANTE,
        quantity: nCerniere,
        ruleId: "artech.cerniere",
        ruleDescription:
          input.sashWeightKg === undefined
            ? // Il limite dichiarato è il MINORE fra le due NB, non solo la
              // soglia della terza cerniera: su questa larghezza le forbici
              // portano `portataKg` e il modulo stesso rifiuta oltre. Prima qui
              // era scritto «fino a 70 kg» fisso, cioè una portata fino a quasi
              // il doppio di quella che il generatore considera montabile
              // (L 600 → 1 forbice → 40 kg): un dato plausibile e sbagliato
              // stampato in distinta.
              `Cerniera centrale registrabile portante e per vasistas (ambidestra) — ${nCerniere} pezzi, ` +
              `valido per ante fino a ${Math.min(PESO_TERZA_CERNIERA_KG, portataKg)} kg`
            : `Cerniera centrale registrabile portante e per vasistas (ambidestra) — ${nCerniere} pezzi per un'anta da ${input.sashWeightKg} kg`,
      },
      ...ARTICOLAZIONE_SUPERIORE.map(({ position, code, montante }) => ({
        position,
        code,
        quantity: 1,
        ruleId: "artech.cerniere",
        ruleDescription: `Articolazione superiore anta semifissa, montante ${montante} (1 per mano: i due angoli inferiori sono speculari)`,
      })),
      {
        position: "corpo-articolazione",
        code: CORPO_ARTICOLAZIONE,
        // La voce 12 accompagna la 11, non la 10: una per angolo inferiore. La
        // terza cerniera dell'NB sul peso si aggiunge al CENTRO del lato
        // inferiore, dove non c'è articolazione superiore → questa resta a 2.
        quantity: ARTICOLAZIONE_SUPERIORE.length,
        ruleId: "artech.cerniere",
        ruleDescription: "Corpo articolazione superiore (1 per angolo inferiore)",
      },
    );

    // 5) Movimento angolare (codice condiviso A50302.01.02, quantità propria) +
    // 6) limitatore di corsa 18 mm (= n. movimenti angolari).
    lines.push(
      {
        position: MOVIMENTO_ANGOLARE.position,
        code: MOVIMENTO_ANGOLARE.code,
        quantity: N_MOVIMENTI,
        ruleId: "artech.fissi",
        ruleDescription: MOVIMENTO_ANGOLARE.descr,
      },
      {
        position: "limitatore-corsa",
        code: "A50196.00.18",
        quantity: N_MOVIMENTI,
        ruleId: "artech.fissi",
        ruleDescription: "Limitatore di corsa 18 mm = n. movimenti angolari (ASSUNZIONE)",
      },
    );

    // 13) Incontri nottolino — quantità = colonna NOT.(GR) del cremonese (ASSUNZIONE).
    if (gr.nottolini > 0)
      lines.push({
        position: "incontri-nottolino",
        code: "A51400.05.02",
        quantity: gr.nottolini,
        ruleId: "artech.incontri",
        ruleDescription: `Incontri nottolino aria 12 (NOT. GR0${gr.gr} = ${gr.nottolini})`,
      });

    return lines;
  },
};
