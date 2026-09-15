import { execFileSync } from "node:child_process";
import { decodeVision } from "../src/server/maniglie/vision-decode";
import { parseVision, BANDE_VISION_2026 } from "../src/server/maniglie/vision-parse";
import { articoliVision } from "../src/server/maniglie/vision-codici";
const pdf = "/tmp/claude-0/-home-user-AGB-Finder/e6bf1587-fae4-5464-8cb5-97e581c01c58/scratchpad/vision2026.pdf";
const raw = execFileSync("pdftotext", ["-layout", pdf, "-"], { maxBuffer: 64e6, encoding: "buffer" });
const { articoli, esclusi } = articoliVision(parseVision(decodeVision(raw), BANDE_VISION_2026));
console.log(`articoli ${articoli.length} · esclusi ${esclusi.length}`);
const attesi = ["0ID45FISSOCM","0ID55FISSOCM","0ID81RCM","0ID81ROM","0ID82DKSMCM","0ID82DKSMOM","0ID91RCM","0ID92DKSMCM"];
const norm = new Set(articoli.map(a => a.codeNorm));
console.log("codici confermati da COLOMBO presenti:", attesi.filter(c => norm.has(c)).length, "/", attesi.length);
console.log("mancanti:", attesi.filter(c => !norm.has(c)));
console.log("codici duplicati:", articoli.length - new Set(articoli.map(a=>a.code)).size);
console.log("descrizione più lunga:", Math.max(...articoli.map(a=>a.name.length)));
console.log("iniziano con MANIGLIA:", articoli.filter(a=>a.name.split(" ")[0]==="MANIGLIA").length);
console.log("\ncampione:");
for (const a of [articoli[0]!, articoli.find(a=>a.name.startsWith("ROBOT6 S"))!, articoli.find(a=>a.code.startsWith("0FF13-"))!, articoli.find(a=>a.name.startsWith("MANIGLIONE"))!])
  console.log(`  ${a.code.padEnd(18)} «${a.name}» ${a.priceList}`);
