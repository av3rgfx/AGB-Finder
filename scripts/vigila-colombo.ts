// IL GUARDIANO DELL'AREA DOWNLOAD COLOMBO.
//
// Confronta l'indice pubblico dei documenti con lo stato registrato in
// `src/server/maniglie/documenti-colombo.ts` ed esce NON-ZERO su qualunque
// differenza. Non stampa e prosegue: un run schedulato che fallisce manda una
// mail al proprietario del repo, e quella è la differenza fra un segnale e una
// riga di log — il segnale precedente viveva in uno scrollback, ha sparato una
// volta sola, e si è perso quando COLOMBO ha rifatto il sito.
//
// Nessuna password: le pagine dell'area download rispondono a una GET nuda.
//
// Uso:
//   pnpm vigila:colombo             # confronta ed esce non-zero se differisce
//   pnpm vigila:colombo --aggiorna  # stampa il blocco da incollare nel modulo
import { DOCUMENTI } from "../src/server/maniglie/documenti-colombo";
import {
  confronta,
  parseCategorie,
  parseDocumenti,
  type Indice,
} from "../src/server/maniglie/vigilanza";

const BASE = "https://download.colombodesign.com";

async function pagina(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} su ${url}`);
  return res.text();
}

async function main() {
  const aggiorna = process.argv.includes("--aggiorna");

  const categorie = parseCategorie(await pagina(`${BASE}/`));
  // Zero categorie NON è «nessuna novità»: è il sito che è cambiato di nuovo.
  // Senza questa riga il guardiano direbbe «tutto a posto» per sempre — cioè
  // ricadrebbe esattamente nella classe di difetto per cui è nato. È anche la
  // stessa guardia che il 2026-09-15 ha fatto morire `foto:colombo` in 29
  // secondi senza toccare Blob né DB: il pezzo di quella storia che ha
  // funzionato.
  if (categorie.length === 0) {
    throw new Error(
      "Nessuna categoria nell'indice dell'area download: la pagina è cambiata. " +
        "Aggiornare parseCategorie in src/server/maniglie/vigilanza.ts.",
    );
  }
  console.log(`▶ ${categorie.length} categorie nell'indice`);

  const attuale: Indice = {};
  for (const c of categorie) {
    const file = parseDocumenti(await pagina(`${BASE}/mostra.php?lang=en&catalogo=${c.id}`));
    attuale[c.id] = { titolo: c.titolo, file };
  }

  if (aggiorna) {
    console.log("\n// ── da incollare in src/server/maniglie/documenti-colombo.ts ──");
    console.log(`export const DOCUMENTI: Indice = ${JSON.stringify(attuale, null, 2)};`);
    return;
  }

  const righe = confronta(attuale, DOCUMENTI);
  if (righe.length === 0) {
    console.log("✓ l'area download COLOMBO è come la conosciamo");
    return;
  }
  console.log(`\n▶ ${righe.length} novità nell'area download COLOMBO:\n`);
  for (const r of righe) console.log(`  ${r}`);
  console.log(
    "\nSe sono cambiamenti attesi, ratificarli con:\n" +
      "  pnpm vigila:colombo --aggiorna\n" +
      "e committare il blocco in src/server/maniglie/documenti-colombo.ts.\n" +
      "⚠️ Un CATALOGO o un LISTINO nuovo qui significa prodotti nuovi da COLOMBO.",
  );
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
