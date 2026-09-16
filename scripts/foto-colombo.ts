// Foto degli articoli COLOMBO: dall'archivio ufficiale a Vercel Blob PRIVATO.
//
// NON scarica i 3,5 GB. Legge l'indice dei 79 zip con richieste Range sulle
// central directory (pochi MB), decide quali foto servono con il modulo puro
// `foto-archivio.ts`, e scarica SOLO quelle — una voce di zip alla volta, sempre
// per intervalli. Sul listino 05-26 sono 320 foto su 707.
//
// Idempotente: ciò che è già su Blob non si riscarica, quindi rilanciarlo dopo un
// listino nuovo costa la sola rilettura degli indici.
//
// Il confine col repo pubblico, detto per intero perché la mezza verità è già
// costata un commento sbagliato: nel repo stanno i 79 nomi degli ARCHIVI
// (`ARCHIVI`) e **quindici** nomi di singoli file (`FILE_MODELLO`, dove COLOMBO
// scrive la serie nel nome). Non ci stanno gli altri ~690 nomi, e **mai** i byte
// delle foto. Il contenuto di ogni zip si rilegge dal vivo a ogni run con le
// Range sulle central directory: si localizza l'elenco degli ZIP, non l'indice
// dei FILE, quindi l'abbinamento foto→codice resta misurato sulla realtà e non
// postulato. Per questo il gate d'integrazione prende l'indice da
// `COLOMBO_FOTO_INDEX`, un file fuori dal repo.
//
// Uso:
//   BLOB_READ_WRITE_TOKEN=... pnpm foto:colombo
//   pnpm foto:colombo --dry-run              # non tocca né Blob né DB
//   pnpm foto:colombo --dry-run --dump f.json # scrive l'indice, per il gate
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { head, put } from "@vercel/blob";
import sharp from "sharp";
import {
  abbinaFoto,
  ARCHIVI,
  chiaveFoto,
  copertineDichiarate,
  urlArchivio,
  type FotoArchivio,
} from "../src/server/maniglie/foto-archivio";
import {
  datiVoce,
  inizioDati,
  leggiCentralDirectory,
  parseCentralDirectory,
  type VoceZip,
} from "../src/server/maniglie/zip-range";

const BASE = "https://download.colombodesign.com";
const MARCA = "COLOMBO";
/** I due formati della spec: miniatura di riga e foto di scheda. */
const FORMATI = [320, 900] as const;
/** Quante foto attende la sessione che ha scritto la tabella: 707. Se cambia, si dice. */
const FOTO_ATTESE = 707;

// ── area download ───────────────────────────────────────────────────────────

// L'INDICE DEGLI ARCHIVI, E PERCHÉ NON SI RASCHIA PIÙ.
//
// Fino al 2026-09 la lista degli zip si scopriva con una POST al form a sola
// password di `download.colombodesign.com/`, raschiando dall'HTML i link
// `'/download/maniglie/archivio/*.zip'` — fra APICI SINGOLI, perché erano dentro
// un `onclick`. Poi COLOMBO ha rifatto l'area download: non è più un elenco
// piatto di file ma un indice di 29 categorie `mostra.php?lang=en&catalogo=NNN`
// che pubblicano SOLO PDF. L'indice dell'archivio fotografico non compare più in
// nessuna pagina, e la directory risponde 403 — mentre gli zip restano serviti,
// e senza password (79 su 79, verificato il 2026-09-16).
//
// La lista viene quindi da `ARCHIVI`, che era GIÀ l'autorità: un archivio non in
// tabella veniva comunque ignorato, quindi non si scarica un file diverso da
// prima. Cambia solo COME SI FALLISCE — vedi il rifiuto in `main`.
//
// Costo dichiarato: un archivio NUOVO non è più scopribile. Quel segnale si è
// spostato su `scripts/vigila-colombo.ts`, che sorveglia l'indice pubblico dei
// documenti; le domande C7 e C8 in `docs/superpowers/domande-colombo.md`.

async function scarica(path: string, da?: number, a?: number): Promise<Buffer> {
  const headers: Record<string, string> = {};
  if (da !== undefined) headers.Range = `bytes=${da}-${a}`;
  const res = await fetch(BASE + encodeURI(path), { headers });
  if (!res.ok) throw new Error(`${res.status} su ${path}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Una Range servita CORTA è l'ultimo percorso residuo a un indice parziale, e
  // sarebbe silenzioso: `parseCentralDirectory` si ferma al primo record che non
  // ci sta e restituisce una lista più breve **senza sollevare**, quindi
  // quell'archivio contribuirebbe meno foto, `voci.length > 0` passerebbe, e si
  // scriverebbe comunque. Qui diventa un errore col nome dell'archivio.
  const attesi = da === undefined ? undefined : a! - da + 1;
  if (attesi !== undefined && buf.length !== attesi) {
    throw new Error(`Range corta su ${path}: ${buf.length} byte invece di ${attesi}`);
  }
  return buf;
}

/**
 * Il messaggio di un errore, `cause` compresa.
 *
 * `fetch` fallito dice solo `"fetch failed"`: il motivo vero — `ENOTFOUND`,
 * `ECONNRESET`, un timeout — sta in `e.cause`, e buttarlo rende il messaggio più
 * povero **proprio** nel caso in cui serve a distinguere la rete dalla tabella.
 */
function descrivi(e: unknown): string {
  const err = e as { message?: string; cause?: { message?: string } };
  const causa = err?.cause?.message;
  return causa ? `${err.message} (${causa})` : (err?.message ?? String(e));
}

async function dimensione(path: string): Promise<number> {
  const res = await fetch(BASE + encodeURI(path), { method: "HEAD" });
  const n = Number(res.headers.get("content-length"));
  if (!Number.isFinite(n) || n <= 0) throw new Error(`dimensione ignota per ${path}`);
  return n;
}

/** Le voci `.jpg` di uno zip, senza scaricarlo: una HEAD e due Range. */
async function vociDi(path: string): Promise<VoceZip[]> {
  const totale = await dimensione(path);
  const lunghezzaCoda = Math.min(65536 + 22, totale);
  const coda = await scarica(path, totale - lunghezzaCoda, totale - 1);
  const { inizio, lunghezza } = leggiCentralDirectory(coda, totale);
  const cd = await scarica(path, inizio, inizio + lunghezza - 1);
  return parseCentralDirectory(cd).filter(
    (v) => v.nome.toLowerCase().endsWith(".jpg") && !v.nome.includes("__MACOSX"),
  );
}

/** I byte originali di una voce: il local header dice dove cominciano davvero. */
async function bytesDi(path: string, voce: VoceZip): Promise<Buffer> {
  const lh = await scarica(path, voce.offset, voce.offset + 29);
  const da = inizioDati(lh, voce);
  const corpo = await scarica(path, da, da + voce.csize - 1);
  return datiVoce(lh, corpo, voce);
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const dump = process.argv[process.argv.indexOf("--dump") + 1];
  const dumpAttivo = process.argv.includes("--dump") && Boolean(dump);

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token && !dryRun) throw new Error("BLOB_READ_WRITE_TOKEN mancante nell'ambiente.");

  console.log(`▶ indicizzo ${Object.keys(ARCHIVI).length} archivi COLOMBO…`);

  // 1. l'indice: due Range per zip, niente byte di foto.
  //
  // Si raccolgono TUTTI i falliti e ci si rifiuta dopo, non al primo: lo scenario
  // realistico non è «un archivio sparito» ma «ne hanno rinominati sei», e col
  // fail-fast sarebbero sei cicli run→commit→run da sette minuti l'uno.
  const foto: (FotoArchivio & { path: string; voce: VoceZip })[] = [];
  const problemi: string[] = [];
  for (const archivio of Object.keys(ARCHIVI)) {
    const path = urlArchivio(archivio);
    let voci: VoceZip[];
    try {
      voci = await vociDi(path);
    } catch (e) {
      problemi.push(`${archivio} — ${descrivi(e)}`);
      continue;
    }
    // Uno zip che c'è ma è vuoto passa la HEAD e non produce alcun errore: i suoi
    // articoli perderebbero la foto dentro un run VERDE. Misurato il 2026-09-16:
    // zero archivi vuoti su 79. Non è mai legittimo.
    if (voci.length === 0) {
      problemi.push(`${archivio} — nessun .jpg nello zip`);
      continue;
    }
    for (const voce of voci) {
      const nome = voce.nome.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
      foto.push({ archivio, nome, path, voce });
    }
  }

  // Il rifiuto sta PRIMA di Blob e del DB, ed è deliberato: il passo 4 azzera
  // `image_url` e riscrive solo gli abbinati, quindi un indice parziale non
  // darebbe un errore ma un SUCCESSO più povero — `✓ N articoli con foto` con N
  // più piccolo, e nessuno se ne accorge. (La transazione è atomica: il pericolo
  // non è mai stato un crash a metà, è il run verde.)
  //
  // Non esiste un flag per proseguire: un archivio ritirato davvero si registra
  // togliendo la sua riga da ARCHIVI, in un commit che passa da review.
  if (problemi.length > 0) {
    // ⚠️ IL CONSIGLIO DEVE DISTINGUERE, o fa perdere foto in un run VERDE.
    //
    // 79 archivi × 3 richieste = ~237 richieste a ogni run: un solo 502, un 429 o
    // un timeout finisce qui esattamente come un 404. Se il messaggio dicesse
    // «correggi la tabella» in tutti i casi, l'operatore toglierebbe una riga da
    // ARCHIVI per un disservizio passeggero — e il run dopo sarebbe VERDE, con
    // quegli articoli senza foto e l'unica traccia in `prima → dopo`, che si
    // legge come «ovvio, ho tolto quella riga».
    //
    // Solo 404 e 403 dicono qualcosa sulla TABELLA; tutto il resto dice qualcosa
    // sulla RETE, e si riprova.
    const suTabella = problemi.filter((p) => / (404|403) /.test(p));
    const consiglio =
      suTabella.length === problemi.length
        ? "Il fornitore non serve più quei nomi: correggere ARCHIVI in " +
          "src/server/maniglie/foto-archivio.ts, in un commit."
        : suTabella.length === 0
          ? "Nessuno è un 404/403: sono errori di RETE, non della tabella. " +
            "Riprovare il run; NON togliere righe da ARCHIVI."
          : `${suTabella.length} su ${problemi.length} sono 404/403 e riguardano la ` +
            "tabella; gli altri sono errori di rete. Riprovare il run prima di " +
            "toccare ARCHIVI, e correggerla solo per i 404/403 che restano.";
    throw new Error(
      `${problemi.length} ${problemi.length === 1 ? "archivio non utilizzabile" : "archivi non utilizzabili"} ` +
        `fra quelli di ARCHIVI:\n  ` +
        problemi.join("\n  ") +
        `\n${consiglio}` +
        `\nNiente è stato caricato su Blob e niente è stato scritto a DB.`,
    );
  }
  console.log(`  ${foto.length} foto indicizzate`);
  if (foto.length !== FOTO_ATTESE) {
    // Non è un'asserzione: l'archivio è del fornitore e può cambiare. È una
    // notizia, perché la tabella degli archivi è stata scritta su 707 nomi.
    console.log(`  ℹ️  erano ${FOTO_ATTESE} quando è stata scritta la tabella`);
  }
  if (dumpAttivo) {
    writeFileSync(dump!, JSON.stringify(foto.map((f) => ({ archivio: f.archivio, nome: f.nome }))));
    console.log(`  indice scritto in ${dump}`);
  }

  // 2. l'abbinamento
  const db = new PrismaClient();
  const articoli = await db.article.findMany({
    where: { brand: MARCA },
    select: { id: true, code: true, codeNorm: true, name: true },
  });
  // Il «prima» per la riga finale. NON è una soglia e non blocca nulla: la PR
  // #60 fece scendere la copertura da 2.118 a 1.609 DI PROPOSITO, togliendo 350
  // foto che mostravano la finitura di un altro codice. Un calo può essere la
  // decisione giusta; quello che mancava era il numero di partenza, senza il
  // quale il numero d'arrivo non si può leggere. Zero stato nuovo: il DB è già
  // il registro dell'ultimo run.
  const conFotoPrima = await db.article.count({
    where: { brand: MARCA, imageUrl: { not: null } },
  });
  const perArticolo = abbinaFoto(MARCA, articoli, foto);
  // Le COPERTINE non le sceglie nessun articolo, ed è il motivo per cui
  // esistono: dei gruppi che ne hanno una, nessuno ha un codice con la finitura
  // provata. Senza questa riga il run non le caricherebbe affatto e la tessera
  // resterebbe una tessera-parola — stato coerente, ma non quello voluto.
  const copertine = copertineDichiarate();
  const chiaviScelte = new Set([...perArticolo.values(), ...copertine.values()]);
  const pct = ((100 * perArticolo.size) / articoli.length).toFixed(1);
  console.log(
    `▶ abbinamento: ${perArticolo.size}/${articoli.length} articoli (${pct}%) con ${new Set(perArticolo.values()).size} foto · ${copertine.size} copertine di gruppo`,
  );
  // Sta PRIMA della scrittura, e non alla fine come conferma, per una ragione
  // sola: così la si vede anche in `--dry-run`, che è l'unico modo di esercitarla
  // senza toccare Blob — e il dry run è dove un umano la legge davvero prima di
  // lanciare il run vero. ⚠️ Non è un punto di decisione: qui lo script prosegue
  // da sé, e in Actions non c'è nessuno davanti al log.
  const delta = perArticolo.size - conFotoPrima;
  console.log(
    `  articoli con foto a DB: ${conFotoPrima} → ${perArticolo.size} ` +
      `(${delta >= 0 ? "+" : ""}${delta})`,
  );

  if (dryRun) {
    console.log("— dry run: né Blob né DB toccati");
    await db.$disconnect();
    return;
  }

  // 3. le foto scelte, e SOLO quelle
  let caricate = 0;
  let saltate = 0;
  for (const f of foto) {
    const chiave = chiaveFoto(f.archivio, f.nome);
    if (!chiaviScelte.has(chiave)) continue;
    const gia = await head(`${chiave}-${FORMATI[0]}.webp`, { token: token! }).catch(() => null);
    if (gia) {
      saltate++;
      continue;
    }
    const originale = await bytesDi(f.path, f.voce);
    for (const size of FORMATI) {
      // sharp applica da sé il profilo ICC incorporato: il CMYK dell'archivio
      // esce in sRGB coi colori giusti. La conversione NON è un'ottimizzazione —
      // un JPEG CMYK il browser non lo disegna affatto.
      const webp = await sharp(originale)
        .resize(size, size, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      await put(`${chiave}-${size}.webp`, webp, {
        access: "private",
        token: token!,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "image/webp",
      });
    }
    caricate++;
    if (caricate % 25 === 0) console.log(`  ${caricate} caricate…`);
  }
  console.log(`▶ Blob: ${caricate} caricate · ${saltate} già presenti`);

  // 4. le chiavi a DB, in una transazione
  //
  // L'azzeramento PRIMA non è pigrizia: un articolo che perde la foto — tabella
  // corretta, listino nuovo, archivio cambiato — deve perderla davvero. Senza,
  // resterebbe a schermo la foto di prima e nessun conteggio andrebbe a zero.
  await db.$transaction([
    db.article.updateMany({ where: { brand: MARCA }, data: { imageUrl: null } }),
    ...[...perArticolo].map(([id, chiave]) =>
      db.article.update({ where: { id }, data: { imageUrl: chiave } }),
    ),
  ]);
  console.log(
    `✓ scritti ${perArticolo.size} articoli con foto, ${articoli.length - perArticolo.size} senza`,
  );
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
