import { browseLabel } from "./curatela";
import {
  codiceSenzaFinitura,
  FINITURE_PER_CODICE,
  finituraDiCodice,
  finituraDiTesto,
} from "./finiture";

/**
 * L'ARCHIVIO FOTOGRAFICO UFFICIALE COLOMBO, mappato al catalogo.
 * (area download, sezione PHOTO ARCHIVE: 79 zip, 3,5 GB, 707 JPEG **CMYK**)
 *
 * L'unità è l'ARCHIVIO, non il gruppo di sfoglio: `01_Fedra/` *è* l'etichetta, non
 * un titolo da decifrare. Ma un gruppo a volte ne ospita DUE — la maniglia e il
 * pomolo, o due serie dello stesso nome commerciale — e allora la cartella da sola
 * non sceglie: serve la `serie`, cioè il prefisso di codice, e la si dichiara SOLO
 * dove COLOMBO l'ha scritta.
 *
 * `etichetta: null` = quell'archivio non aggancia articoli per nome di modello.
 * Tre ragioni diverse, annotate riga per riga: prodotto non ancora a listino ·
 * accessori (lì il codice sta nel nome del file, e ci pensa il gradino 3) · **serie
 * non decidibile**. L'ultima è quella che conta: la serie sbagliata produce una
 * foto che esiste, si vede benissimo ed è di un altro prodotto — nessun errore,
 * nessun warning, nessuno se ne accorge.
 *
 * La tabella è scritta a mano riga per riga, comprese le 48 che sono l'identità:
 * una tabella che si calcola da sé nasconde i casi in cui il calcolo sbaglia, ed è
 * esattamente sui casi storti (`01_Robot4` → ROBOQUATTRO) che serve.
 */
export interface VoceArchivio {
  /** Etichetta di sfoglio, post-curatela. `null` = nessun aggancio per modello. */
  etichetta: string | null;
  /** Prefisso di codice; solo dove un'etichetta ha più archivi. */
  serie?: string;
}

export const ARCHIVI: Record<string, VoceArchivio> = {
  // ── prodotti nuovi: a catalogo 2026, non ancora a listino ───────────────────
  // Non è un difetto: quando COLOMBO li metterà a listino si aggancieranno da soli.
  "00a_Laconica": { etichetta: null },
  "00b_Robot6": { etichetta: null },
  "00c_Robot6S": { etichetta: null },
  "00d_Halo": { etichetta: null },
  "00e_Kubo": { etichetta: null },

  // ── modelli: un archivio, un'etichetta ─────────────────────────────────────
  "01_963": { etichetta: "963" },
  "01_Alato": { etichetta: "ALATO" },
  "01_Alba": { etichetta: "ALBA" },
  "01_Ama": { etichetta: "AMA" },
  "01_Blazer": { etichetta: "BLAZER" },
  "01_Cameo": { etichetta: "CAMEO" },
  "01_Daytona": { etichetta: "DAYTONA" },
  "01_Dea": { etichetta: "DEA" },
  "01_Drop": { etichetta: "DROP" },
  "01_Edo": { etichetta: "EDO" },
  "01_Electra": { etichetta: "ELECTRA" },
  "01_Elle": { etichetta: "ELLE" },
  "01_Ellesse": { etichetta: "ELLESSE" },
  "01_Esprit": { etichetta: "ESPRIT" },
  "01_Fedra": { etichetta: "FEDRA" },
  "01_Flessa": { etichetta: "FLESSA" },
  "01_Gaia": { etichetta: "GAIA" },
  "01_Gira": { etichetta: "GIRA" },
  "01_Gryps": { etichetta: "GRYPS" },
  "01_Ida": { etichetta: "IDA" },
  "01_Isy": { etichetta: "ISY" },
  "01_Lara": { etichetta: "LARA" },
  "01_Libra": { etichetta: "LIBRA" },
  "01_Mach": { etichetta: "MACH" },
  "01_Madi": { etichetta: "MADI" },
  "01_Mapo": { etichetta: "MAPO" },
  "01_Meta": { etichetta: "META" },
  "01_Mixa": { etichetta: "MIXA" },
  "01_Moon": { etichetta: "MOON" },
  "01_Olly": { etichetta: "OLLY" },
  "01_Peak": { etichetta: "PEAK" },
  "01_Pegaso": { etichetta: "PEGASO" },
  "01_Peter": { etichetta: "PETER" },
  "01_Piuma": { etichetta: "PIUMA" },
  "01_Sirio": { etichetta: "SIRIO" },
  "01_Slim": { etichetta: "SLIM" },
  "01_Star": { etichetta: "STAR" },
  "01_Tacta": { etichetta: "TACTA" },
  "01_Taipan": { etichetta: "TAIPAN" },
  "01_Tecno": { etichetta: "TECNO" },
  "01_Tender": { etichetta: "TENDER" },
  "01_Tool": { etichetta: "TOOL" },
  "01_Twitty": { etichetta: "TWITTY" },
  "01_Viola": { etichetta: "VIOLA" },
  "01_Wing": { etichetta: "WING" },
  "01_Zelda": { etichetta: "ZELDA" },

  // ── due archivi che ora ospitano anche una CREMONESE ───────────────────────
  // Dal 2026-08-05 `HEIDI/PETER` si elenca sotto HEIDI e `LUNDCREM` sotto LUND
  // (fusioni chieste da Andrea). Ma la cremonese è un altro prodotto, e senza
  // `serie` prenderebbe la foto della maniglia — e qui la regola sulle finiture
  // NON salva: `0CD32-UB` avrebbe `Heidi_R_UB`, finitura provata GIUSTA e
  // prodotto SBAGLIATO.
  // ⚠️ La fonte della serie è il LISTINO, non i nomi dei file: COLOMBO scrive
  // «HEIDI CD31R» contro «HEIDI/PETER CREM CD32», «LUND SE11R» contro
  // «LUNDCREM SE12». Va detto, perché la regola di questo campo è «solo dove
  // COLOMBO l'ha scritta» e qui l'ha scritta altrove.
  "01_Heidi": { etichetta: "HEIDI", serie: "CD31" },
  "01_Lund": { etichetta: "LUND", serie: "SE11" },

  // ── la serie ROBOTECH: sigle interne, tradotte ─────────────────────────────
  // `Robot2` non è «Robot 2»: è ROBODUE. La traduzione è verificata sul listino
  // (ognuna di queste etichette esiste, e il gate d'integrazione lo prova).
  "01_Robot2": { etichetta: "ROBODUE" },
  "01_Robot3": { etichetta: "ROBOTRE" },
  "01_Robot4": { etichetta: "ROBOQUATTRO" },
  "01_Robot4S": { etichetta: "ROBOQUATTRO S" },
  "01_Robot5": { etichetta: "ROBOCINQUE" },
  "01_Robot5S": { etichetta: "ROBOCINQUE S" },
  // ROBOT ha due archivi: i nomi dei file dicono `robot41_*` e `robot75_*`, e
  // l'indice del listino COLOMBO stampa «robot CD41» fra le maniglie e
  // «robot CD75» fra i pomoli. La serie è scritta, non dedotta.
  "01_Robot1_m": { etichetta: "ROBOT", serie: "CD41" },
  "01_Robot1_p": { etichetta: "ROBOT", serie: "CD75" },

  // ── MOOD Collection: One/OneQ e Due/DueQ ───────────────────────────────────
  // Le pagine prodotto del listino COLOMBO stampano CC11 sotto «One», CC21 sotto
  // «OneQ», CC31 sotto «Due» e CC41 sotto «DueQ»; i nomi dei file distinguono
  // `one …` da `oneq …`. Nel listino UFP la descrizione NON dice mai «Q»: senza
  // la serie i due archivi finirebbero sulla stessa etichetta.
  "01_One": { etichetta: "ONE", serie: "CC11" },
  "01_One Q": { etichetta: "ONE", serie: "CC21" },
  "01_Due": { etichetta: "DUE", serie: "CC31" },
  "01_Due Q": { etichetta: "DUE", serie: "CC41" },

  // ── BOLD: `_p` è il POMOLO, e il pomolo bold non è nel listino 2026 ─────────
  // (la sua foto in `02_Pomoli/bold_45.jpg` resta infatti senza articolo).
  // Quindi `_m` non è ambiguo e non ha bisogno di una serie.
  "01_Bold_m": { etichetta: "BOLD" },
  "01_Bold_p": { etichetta: null },

  // ── i tre casi NON DECIDIBILI ──────────────────────────────────────────────
  // SPIDER ha due maniglie a listino (MR11 e MR15), MILLA due (LC31, LC41),
  // TRAMA due (LC71, LC81). Gli archivi sono due per ciascuno, ma l'ordinale
  // della cartella non è la serie e nessuna fonte di COLOMBO li accoppia.
  // 66 codici restano senza foto: è il prezzo dichiarato di non indovinare.
  // → domanda aperta per COLOMBO (handoff.md §DA CHIEDERE).
  "01_Spider_m": { etichetta: null },
  "01_Spider_p": { etichetta: null },
  "01_Milla_1": { etichetta: null },
  "01_Milla_2": { etichetta: null },
  "01_Trama_1": { etichetta: null },
  "01_Trama_2": { etichetta: null },

  // ── accessori: qui il codice sta nel NOME DEL FILE (gradino 3) ─────────────
  // Sono le sezioni che per nome di modello sarebbero irraggiungibili —
  // maniglioni, pomoli, incasso, blindate, complementi — e agganciano 322 codici.
  "02_Pomoli": { etichetta: null },
  "03_Maniglioni_Pulls": { etichetta: null },
  "04_Incasso_Flush handles": { etichetta: null },
  "05_Blindate_Armored door": { etichetta: null },
  "06_Complementi": { etichetta: null },
  "07_Kombo_Box": { etichetta: null },
};

/**
 * REGOLE PER SINGOLO FILE, dentro gli archivi che un'etichetta non ce l'hanno.
 *
 * `02_Pomoli` raccoglie i pomoli di mezzo catalogo, e il suo nome non dice a
 * quale gruppo appartenga ciascuno. Ma il nome del FILE sì, e l'indice del
 * listino COLOMBO — sezione «pomoli / door knobs» — stampa accanto a ognuno la
 * sua serie: «130 round ID25», «131 round ID35», «132 square LC25», «133 square
 * LC35», «124 cut MS15», «125 cut MS25», «128 robot CD45», «129 robot CD55»,
 * «129 robot CD65». È la stessa qualità di prova delle righe ROBOT CD41/CD75 in
 * `ARCHIVI`: due cose scritte da COLOMBO che combaciano, non una deduzione.
 *
 * ⚠️ Quello che NON entra, e perché: `bold_45`, `daytona_45`, `drop_45`,
 * `mapo_45`, `Moon_45`, `spider_45` sono i pomoli di modelli che hanno già il
 * loro archivio di maniglia. Quei gruppi sono coperti al 100% dalla maniglia, e
 * quale serie sia il pomolo non è scritto da nessuna parte: attaccarlo
 * significherebbe rischiare un pomolo su un codice di maniglia — una foto che
 * esiste, si vede benissimo, ed è di un altro prodotto.
 *
 * La chiave è `archivio/nome-file`, e vince su `ARCHIVI[archivio]`.
 */
export const FILE_MODELLO: Record<string, VoceArchivio> = {
  // I tre pomoli ROBOTECH che mancavano: ROBOT passa da 65 a 111 codici su 129
  // (resta fuori il solo CD42, «senza mov.»).
  "02_Pomoli/robot45_45": { etichetta: "ROBOT", serie: "CD45" },
  "02_Pomoli/robot55_45": { etichetta: "ROBOT", serie: "CD55" },
  "02_Pomoli/robot65_45": { etichetta: "ROBOT", serie: "CD65" },
  // `robot75_45` NON è qui: il CD75 ce l'ha già `01_Robot1_p`, che è il suo
  // archivio di modello. Due sorgenti per la stessa coppia sarebbero due verità.

  "02_Pomoli/round25_45": { etichetta: "ROUND", serie: "ID25" },
  "02_Pomoli/round35_45": { etichetta: "ROUND", serie: "ID35" },
  "02_Pomoli/square25_45": { etichetta: "SQUARE", serie: "LC25" },
  "02_Pomoli/square35_45": { etichetta: "SQUARE", serie: "LC35" },
  "02_Pomoli/cut15_45": { etichetta: "CUT", serie: "MS15" },
  "02_Pomoli/cut25_45": { etichetta: "CUT", serie: "MS25" },
  // PUSH: cinque codici, tutti LC55, e un file solo. Una serie qui non
  // separerebbe niente, e un vincolo che non separa può solo togliere foto.
  "02_Pomoli/push_45": { etichetta: "PUSH" },
  // MOOD Collection: il listino scrive «POMOLO ONE …» (CC15) e «POMOLO ONE Q …»
  // (CC25), i file «pomolo one strawberry red» e «pomolo one q lime green».
  // Le parole sono di COLOMBO da entrambe le parti.
  "02_Pomoli/pomolo one strawberry red": { etichetta: "POMOLO", serie: "CC15" },
  "02_Pomoli/pomolo one q lime green": { etichetta: "POMOLO", serie: "CC25" },
};

/**
 * Le etichette di sfoglio che COLOMBO fotografa come MODELLO: quelle a cui
 * `ARCHIVI` o `FILE_MODELLO` assegnano un archivio.
 *
 * Misurate sul listino 02-26: **63 gruppi su 102**, e tutti e 63 hanno almeno
 * una foto. Gli altri 39 sono TIPOLOGIE (BOCCHETTA raccoglie 22 serie diverse,
 * MANIGLIONE 52): lì una foto sola sarebbe un modello a caso spacciato per la
 * categoria, e la tessera di livello 1 non ne mostra nessuna.
 *
 * La distinzione NON è un nostro giudizio: è come il fornitore ha organizzato
 * il suo archivio fotografico.
 */
export function etichetteModello(): ReadonlySet<string> {
  const out = new Set<string>();
  for (const v of Object.values(ARCHIVI)) if (v.etichetta) out.add(v.etichetta);
  for (const v of Object.values(FILE_MODELLO)) if (v.etichetta) out.add(v.etichetta);
  return out;
}

/**
 * La voce che vale per una foto: la regola del suo file se c'è, altrimenti
 * quella del suo archivio.
 */
function voceDi(archivio: string, nome: string): VoceArchivio | undefined {
  return FILE_MODELLO[`${archivio}/${nome}`] ?? ARCHIVI[archivio];
}

/**
 * Uno scatto d'ambiente non è una foto di prodotto: `Robo4_def.jpg` è 8268×7087,
 * 34 MB, la maniglia su fondo colorato con ombre lunghe. In una griglia di
 * miniature su bianco stona, e non dice nulla in 44 pixel. Sono 68 file su 707, e
 * si riconoscono dal suffisso `_def` o dal nome della campagna (`Mood`, `IMG_`).
 */
export function scattoDiProdotto(nome: string): boolean {
  // Per parole intere, e non con `\b`: in `03_Mood ocean` il confine fra `_` e
  // `m` non è un confine di parola per una regexp, perché `_` è un carattere di
  // parola — e quel file sarebbe passato.
  const parole = nome.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return (
    parole.at(-1) !== "def" && !parole.includes("mood") && !parole.includes("img")
  );
}

/**
 * La finitura che COLOMBO ha scritto nel nome del file: come SUO codice
 * (`Fedra_1OL`, `robot41_4NM_new`) **oppure a parole** (`due frontale capri
 * blue`).
 *
 * ⚠️ Le parole non si cercavano, e sono **268 file su 638**: è la ragione per
 * cui tutti gli otto `0CC31R-C0x` mostravano la maniglia blu. Il commento qui
 * diceva che le parole «non contano» perché sono due lingue e nessun elenco
 * chiuso — l'elenco chiuso invece esiste, sono le 31 finiture pubblicate, e le
 * loro grafie reali stanno in `finiture.ts`, che è il modulo che sa come si
 * chiamano.
 *
 * Le due strade sono DISGIUNTE sui 638 scatti reali (zero file le hanno
 * entrambe), quindi l'ordine fra loro non decide nulla: il codice viene prima
 * perché è la grafia più stretta.
 */
export function finituraDiFoto(nome: string): string | null {
  const m = /[ _-]\d?(C\d\d|[A-Z]{2})(_new)?$/i.exec(nome);
  if (m) {
    const codice = m[1]!.toUpperCase();
    if (FINITURE_PER_CODICE.has(codice)) {
      // ⚠️ Un BICOLORE ha due codici in coda, e con la cifra facoltativa quelli
      // separati da un trattino entrerebbero: `963_4GL-GM` non è «GM», è
      // GRAFITE/GRAFITE MAT. Il secondo codice si riconosce da ciò che precede
      // il separatore. (Quelli attaccati — `milla1_1OLOM`, `Alba_2CRNM` — cadono
      // già da soli, perché in coda ci sono quattro lettere e non due.)
      const altro = /(C\d\d|[A-Z]{2})$/i.exec(nome.slice(0, m.index));
      if (altro && FINITURE_PER_CODICE.has(altro[1]!.toUpperCase())) return null;
      return codice;
    }
  }
  return finituraDiTesto(nome);
}

/**
 * La variante ZERO (rosetta a scomparsa) è un prodotto a sé: 156 codici a listino
 * la nominano nella descrizione e 71 file dell'archivio nel nome. Sono due parole
 * scritte da COLOMBO in due posti diversi, e devono combaciare — la foto liscia su
 * un articolo ZERO è la foto sbagliata, non una foto approssimata.
 */
export function varianteZero(s: string): boolean {
  return /\bzero\b/i.test(s);
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * La chiave Blob è DERIVATA dalla sorgente, non dall'articolo: due articoli che
 * condividono la foto condividono il file, e lo script la carica una volta sola.
 * Verificato sui 707 nomi veri: zero collisioni.
 */
export function chiaveFoto(archivio: string, nome: string): string {
  return `maniglie/colombo/${slug(archivio)}/${slug(nome)}`;
}

// ═══════════════════════════════════════════════════════════════
// L'ABBINAMENTO
// ═══════════════════════════════════════════════════════════════

export interface FotoArchivio {
  /** Cartella dello zip, senza `.zip`: `01_Fedra`. */
  archivio: string;
  /** Nome del file senza estensione: `Fedra_1OL`. */
  nome: string;
}

export interface ArticoloDaAbbinare {
  id: string;
  code: string;
  codeNorm: string;
  name: string;
}

/** Lo 0 di testa è un marcatore COLOMBO, non parte della serie. */
const senzaZeroIniziale = (codeNorm: string) => codeNorm.replace(/^0/, "");

/** Sotto i cinque caratteri un nucleo comparirebbe in un nome per puro caso. */
const MIN_NUCLEO = 5;

/**
 * Il nucleo del codice: senza lo 0 di testa e senza la coda di finitura.
 *
 * Il taglio della coda lo fa `codiceSenzaFinitura`, che sa se la finitura era
 * separata dal trattino o attaccata: qui c'era `lastIndexOf("-")`, che su un
 * codice senza trattino avrebbe tolto l'ultimo carattere.
 */
function nucleo(a: ArticoloDaAbbinare): string {
  return senzaZeroIniziale(codiceSenzaFinitura(a.code).replace(/[^A-Za-z0-9]/g, "").toUpperCase());
}

/**
 * Articolo → chiave Blob della sua foto. Gli articoli senza foto **non compaiono**
 * nella mappa: `undefined` è la risposta, e non esiste una chiave «di riserva».
 *
 * Due gradini per SCEGLIERE, uno per DECIDERE SE TENERE, e tutti e tre poggiano
 * su cose che COLOMBO ha scritto:
 *
 *  3. il **codice** dell'articolo è nel nome del file (`ID313 RS_45.jpg`). È
 *     l'unica affermazione che COLOMBO faccia su un codice d'ordine, quindi vince
 *     su tutto, e raggiunge maniglioni, pomoli, bocchette e complementi — che per
 *     nome di modello sarebbero irraggiungibili.
 *  1. la foto del **modello**, preferendo quella della finitura giusta.
 *
 * Poi la regola che decide chi la tiene: **una foto contesa resta solo a chi può
 * dimostrare che è sua**. Sul listino 02-26 e sull'archivio 2026:
 * **1.528 codici su 3.456 (44,2%)**, zero dei quali mostra una finitura provata
 * diversa dalla propria.
 *
 * ⚠️ Il gradino 3 NON è «esatto per costruzione», come diceva l'handoff: è vero
 * sul MODELLO e falso sulla FINITURA, perché aggancia il codice senza la sua
 * coda — i dodici colori di `CC113/Q` cadevano tutti sull'unico file
 * `CC113Q ocean blue`.
 *
 * Su tutti pesa il filtro della variante ZERO, e sul gradino 1 la `serie`
 * dichiarata in `ARCHIVI`.
 */
export function abbinaFoto(
  brand: string,
  articoli: ArticoloDaAbbinare[],
  foto: FotoArchivio[],
): Map<string, string> {
  const usabili = foto
    .filter((f) => scattoDiProdotto(f.nome))
    .map((f) => ({
      voce: voceDi(f.archivio, f.nome),
      chiave: chiaveFoto(f.archivio, f.nome),
      nomeNorm: f.nome.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      finitura: finituraDiFoto(f.nome),
      zero: varianteZero(f.nome),
    }))
    // Ordine stabile: l'abbinamento non deve dipendere dall'ordine in cui si sono
    // letti gli zip, o la stessa richiesta darebbe due chiavi diverse a due run.
    .sort((a, b) => a.chiave.localeCompare(b.chiave));

  // ── prima passata: la SCELTA ───────────────────────────────────────────────
  // Si conserva anche la finitura di ciò che si è scelto: serve alla seconda
  // passata, che è dove vive la regola.
  interface Scelta {
    chiave: string;
    finituraFoto: string | null;
    finituraArt: string | null;
  }
  const scelte = new Map<string, Scelta>();

  for (const a of articoli) {
    const finitura = finituraDiCodice(a.code);
    const nu = nucleo(a);
    if (nu.length >= MIN_NUCLEO) {
      const perCodice = usabili.filter((f) => f.nomeNorm.includes(nu));
      if (perCodice.length > 0) {
        // Il match più lungo: fra `PB13` e `PB1304` vince chi dice di più.
        const ordinate = [...perCodice].sort(
          (x, y) => y.nomeNorm.length - x.nomeNorm.length || x.chiave.localeCompare(y.chiave),
        );
        // Fra i file che nominano il codice, se ce n'è uno della finitura giusta
        // si prende QUELLO. Sul catalogo vero recupera poco (13 → 17 esatte):
        // per quegli accessori l'archivio ha una foto sola e basta.
        const scelta =
          (finitura ? ordinate.find((f) => f.finitura === finitura) : undefined) ?? ordinate[0]!;
        scelte.set(a.id, {
          chiave: scelta.chiave,
          finituraFoto: scelta.finitura,
          finituraArt: finitura,
        });
        continue;
      }
    }

    const etichetta = browseLabel(brand, a.name);
    if (etichetta === null) continue;
    const zero = varianteZero(a.name);
    const serieDelCodice = senzaZeroIniziale(a.codeNorm);
    const candidate = usabili.filter((f) => {
      if (!f.voce || f.voce.etichetta !== etichetta) return false;
      if (f.voce.serie && !serieDelCodice.startsWith(f.voce.serie)) return false;
      return f.zero === zero;
    });
    if (candidate.length === 0) continue;

    const esatta = finitura ? candidate.find((f) => f.finitura === finitura) : undefined;
    const scelta = esatta ?? candidate[0]!;
    scelte.set(a.id, {
      chiave: scelta.chiave,
      finituraFoto: scelta.finitura,
      finituraArt: finitura,
    });
  }

  // ── seconda passata: UNA FOTO CONTESA RESTA SOLO A CHI LA DIMOSTRA SUA ─────
  //
  // Quante finiture DIVERSE puntano allo stesso file? Se più d'una, al più un
  // articolo mostra la propria — e non serve saper leggere la finitura della
  // foto per saperlo. Misurato sul catalogo vero: 667 articoli su 72 file,
  // quindi almeno 595 vedevano il colore di un altro codice.
  //
  // Andrea, che il programma lo usa: «se mancano le foto delle giuste finiture
  // è meglio togliere direttamente le foto, perché confondono e sono
  // fuorvianti». Non è pignoleria: l'agente non sa dedurre la finitura dal
  // codice, quindi all'immagine ci crede.
  const finiturePerChiave = new Map<string, Set<string>>();
  for (const s of scelte.values()) {
    if (s.finituraArt === null) continue;
    const set = finiturePerChiave.get(s.chiave) ?? new Set<string>();
    set.add(s.finituraArt);
    finiturePerChiave.set(s.chiave, set);
  }

  const out = new Map<string, string>();
  for (const [id, s] of scelte) {
    // 1. Chi non ha coda di finitura non AFFERMA nulla, quindi non può
    //    sbagliare: nessuna ragione di togliergli la foto.
    if (s.finituraArt === null) {
      out.set(id, s.chiave);
      continue;
    }
    // 2. Provata uguale: è sua.
    if (s.finituraFoto === s.finituraArt) {
      out.set(id, s.chiave);
      continue;
    }
    // 3. Provata diversa: non è sua, e questo si SA.
    if (s.finituraFoto !== null) continue;
    // 4. Illeggibile: resta solo se nessun altro se la contende. Con due
    //    finiture sullo stesso file, tenerla vorrebbe dire scommettere.
    if ((finiturePerChiave.get(s.chiave)?.size ?? 0) <= 1) out.set(id, s.chiave);
  }
  return out;
}
