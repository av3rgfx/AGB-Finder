import { describe, it, expect } from "vitest";
import { crc32, deflateRawSync } from "node:zlib";
import {
  datiVoce,
  inizioDati,
  leggiCentralDirectory,
  parseCentralDirectory,
} from "./zip-range";

/**
 * Uno zip minimo costruito a mano (APPNOTE.TXT): serve a provare l'aritmetica
 * degli offset, che è il punto in cui questi lettori sbagliano — e sbagliano in
 * silenzio, restituendo byte plausibili invece che i byte giusti.
 */
function zipFinto(voci: { nome: string; dati: Buffer; deflate: boolean }[]): Buffer {
  const locali: Buffer[] = [];
  const centrali: Buffer[] = [];
  let offset = 0;

  for (const v of voci) {
    const nome = Buffer.from(v.nome, "utf8");
    const corpo = v.deflate ? deflateRawSync(v.dati) : v.dati;
    const crc = crc32(v.dati);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4); // versione
    lh.writeUInt16LE(v.deflate ? 8 : 0, 8); // metodo
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(corpo.length, 18);
    lh.writeUInt32LE(v.dati.length, 22);
    lh.writeUInt16LE(nome.length, 26);
    lh.writeUInt16LE(0, 28); // extra: zero QUI e non nella central directory,
    // perché i due campi possono differire ed è per questo che l'inizio dei dati
    // si calcola sempre dal local header.
    locali.push(lh, nome, corpo);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(v.deflate ? 8 : 0, 10);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(corpo.length, 20);
    cd.writeUInt32LE(v.dati.length, 24);
    cd.writeUInt16LE(nome.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt32LE(offset, 42);
    centrali.push(cd, nome);

    offset += 30 + nome.length + corpo.length;
  }

  const parteLocale = Buffer.concat(locali);
  const parteCentrale = Buffer.concat(centrali);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(voci.length, 8);
  eocd.writeUInt16LE(voci.length, 10);
  eocd.writeUInt32LE(parteCentrale.length, 12);
  eocd.writeUInt32LE(parteLocale.length, 16);
  return Buffer.concat([parteLocale, parteCentrale, eocd]);
}

const DUE_VOCI = [
  { nome: "01_Fedra/Fedra_1OL.jpg", dati: Buffer.from("ciao"), deflate: false },
  { nome: "01_Fedra/Fedra_2CR.jpg", dati: Buffer.alloc(2048, 7), deflate: true },
];

describe("zip letto per intervalli", () => {
  it("trova la central directory dalla coda del file", () => {
    const zip = zipFinto(DUE_VOCI);
    const { inizio, lunghezza } = leggiCentralDirectory(zip, zip.length);
    expect(zip.subarray(inizio, inizio + 4)).toEqual(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    expect(inizio + lunghezza).toBe(zip.length - 22);
  });

  it("elenca le voci con metodo, dimensioni e offset", () => {
    const zip = zipFinto(DUE_VOCI);
    const { inizio, lunghezza } = leggiCentralDirectory(zip, zip.length);
    const voci = parseCentralDirectory(zip.subarray(inizio, inizio + lunghezza));
    expect(voci.map((v) => v.nome)).toEqual([
      "01_Fedra/Fedra_1OL.jpg",
      "01_Fedra/Fedra_2CR.jpg",
    ]);
    expect(voci[0]!.metodo).toBe(0);
    expect(voci[1]!.metodo).toBe(8);
    expect(voci[1]!.usize).toBe(2048);
    expect(voci[1]!.csize).toBeLessThan(2048);
  });

  it("restituisce i byte originali, compressi o no", () => {
    const zip = zipFinto(DUE_VOCI);
    const { inizio, lunghezza } = leggiCentralDirectory(zip, zip.length);
    const voci = parseCentralDirectory(zip.subarray(inizio, inizio + lunghezza));

    for (const [i, atteso] of [DUE_VOCI[0]!.dati, DUE_VOCI[1]!.dati].entries()) {
      const v = voci[i]!;
      const lh = zip.subarray(v.offset, v.offset + 30);
      const da = inizioDati(lh, v);
      expect(datiVoce(lh, zip.subarray(da, da + v.csize), v)).toEqual(atteso);
    }
  });

  it("un local header sbagliato non passa in silenzio", () => {
    const zip = zipFinto(DUE_VOCI);
    const { inizio, lunghezza } = leggiCentralDirectory(zip, zip.length);
    const v = parseCentralDirectory(zip.subarray(inizio, inizio + lunghezza))[0]!;
    // Offset spostato di un byte: senza il controllo della firma si tornerebbero
    // byte plausibili e sharp fallirebbe molto più tardi, senza dire perché.
    const storto = zip.subarray(v.offset + 1, v.offset + 31);
    expect(() => datiVoce(storto, Buffer.alloc(4), v)).toThrow(/local header/i);
  });

  it("senza EOCD lo dice invece di leggere a caso", () => {
    expect(() => leggiCentralDirectory(Buffer.alloc(64), 64)).toThrow(/EOCD/);
  });

  it("una central directory dichiarata fuori dal file è un errore", () => {
    const zip = zipFinto(DUE_VOCI);
    expect(() => leggiCentralDirectory(zip, 10)).toThrow(/fuori dal file/);
  });
});
