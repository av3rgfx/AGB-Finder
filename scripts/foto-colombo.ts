// Foto degli articoli COLOMBO: dall'archivio ufficiale a Vercel Blob PRIVATO.
//
// NON scarica i 3,5 GB. Legge l'indice dei 79 zip con richieste Range sulle
// central directory (pochi MB), decide quali foto servono con il modulo puro
// `foto-archivio.ts`, e scarica SOLO quelle — una voce di zip alla volta, sempre
// per intervalli. Sul listino 02-26 sono 228 foto su 707.
//
// Idempotente: ciò che è già su Blob non si riscarica, quindi rilanciarlo dopo un
// listino nuovo costa la sola rilettura degli indici. La verità su «quali foto
// esistono» si rilegge ogni volta da COLOMBO: nessun manifest da tenere allineato,
// e nessun elenco di nomi del fornitore dentro un repo pubblico.
//
// La password dell'area download arriva da COLOMBO_DOWNLOAD_PASSWORD e non è
// scritta da nessuna parte.
//
// Uso:
//   COLOMBO_DOWNLOAD_PASSWORD=... BLOB_READ_WRITE_TOKEN=... pnpm foto:colombo
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

/**
 * L'elenco degli zip, dietro il form a sola password.
 *
 * La POST **è** la pagina: l'area download non emette alcun cookie di sessione,
 * quindi non c'è niente da conservare fra una richiesta e l'altra. E i file sotto
 * `/download/…` non sono protetti affatto — la password sbarra solo l'indice.
 * È una scelta del fornitore su cui non facciamo affidamento: le nostre copie
 * finiscono su uno store Blob privato dietro auth.
 */
async function elencaArchivi(password: string): Promise<string[]> {
  const html = await fetch(`${BASE}/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password, login: "LOGIN" }),
  }).then((r) => r.text());

  const zip = [...html.matchAll(/'(\/download\/maniglie\/archivio\/[^']+\.zip)'/g)].map(
    (m) => m[1]!,
  );
  if (zip.length === 0) {
    throw new Error(
      "Nessun archivio nell'elenco: password errata, oppure il form dell'area download è cambiato.",
    );
  }
  return [...new Set(zip)].sort();
}

async function scarica(path: string, da?: number, a?: number): Promise<Buffer> {
  const headers: Record<string, string> = {};
  if (da !== undefined) headers.Range = `bytes=${da}-${a}`;
  const res = await fetch(BASE + encodeURI(path), { headers });
  if (!res.ok) throw new Error(`${res.status} su ${path}`);
  return Buffer.from(await res.arrayBuffer());
}

async function dimensione(path: string): Promise<number> {
  const res = await fetch(BASE + encodeURI(path), { method: "HEAD" });
  const n = Number(res.headers.get("content-length"));
  if (!Number.isFinite(n) || n <= 0) throw new Error(`dimensione ignota per ${path}`);
  return n;
}

/** Le voci `.jpg` di uno zip, senza scaricarlo: due Range e via. */
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

  const password = process.env.COLOMBO_DOWNLOAD_PASSWORD;
  if (!password) throw new Error("COLOMBO_DOWNLOAD_PASSWORD mancante nell'ambiente.");
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token && !dryRun) throw new Error("BLOB_READ_WRITE_TOKEN mancante nell'ambiente.");

  console.log("▶ area download COLOMBO…");
  const archivi = await elencaArchivi(password);
  console.log(`  ${archivi.length} archivi`);

  // 1. l'indice: due Range per zip, niente byte di foto
  const foto: (FotoArchivio & { path: string; voce: VoceZip })[] = [];
  for (const path of archivi) {
    const archivio = path.replace(/^.*\//, "").replace(/\.zip$/, "");
    if (!(archivio in ARCHIVI)) {
      console.log(`  ⚠️  archivio non in tabella, ignorato: ${archivio}`);
      continue;
    }
    for (const voce of await vociDi(path)) {
      const nome = voce.nome.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
      foto.push({ archivio, nome, path, voce });
    }
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
  const perArticolo = abbinaFoto(articoli, foto);
  const chiaviScelte = new Set(perArticolo.values());
  const pct = ((100 * perArticolo.size) / articoli.length).toFixed(1);
  console.log(
    `▶ abbinamento: ${perArticolo.size}/${articoli.length} articoli (${pct}%) con ${chiaviScelte.size} foto`,
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
  console.log(`✓ ${perArticolo.size} articoli con foto, ${articoli.length - perArticolo.size} senza`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
