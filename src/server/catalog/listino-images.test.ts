import { describe, it, expect } from "vitest";
import {
  parsePdftohtmlXml,
  filterProductImages,
  mapImagesToCodes,
} from "./listino-images";

// XML realistico (layout tipico: foto a sinistra, codici a destra sulla stessa banda).
const XML = `<?xml version="1.0"?>
<pdf2xml>
<page number="300" width="892" height="1262">
<image top="125" left="80" width="213" height="234" src="p-300_1.png"/>
<image top="384" left="69" width="234" height="172" src="p-300_2.png"/>
<image top="582" left="69" width="234" height="263" src="p-300_3.png"/>
<image top="10" left="10" width="122" height="24" src="p-300_logo.png"/>
<text top="195" left="623" width="60" height="17" font="6">E10157.14.93</text>
<text top="211" left="623" width="60" height="17" font="6">E10158.14.93</text>
<text top="455" left="623" width="60" height="17" font="6">E10062.14.93 argento</text>
<text top="653" left="623" width="60" height="17" font="6">E10037.18.93</text>
<text top="1100" left="623" width="60" height="17" font="6">Z99999.99.99</text>
<text top="120" left="400" width="200" height="17" font="6">Nessun codice qui</text>
</page>
</pdf2xml>`;

describe("parsePdftohtmlXml", () => {
  it("estrae immagini (bbox+src) e codici (bbox) dal testo", () => {
    const { images, codes } = parsePdftohtmlXml(XML);
    expect(images).toHaveLength(4);
    expect(images[0]).toMatchObject({ src: "p-300_1.png", top: 125, left: 80, width: 213, height: 234 });
    // solo i <text> che contengono un codice AGB
    expect(codes.map((c) => c.code)).toEqual([
      "E10157.14.93",
      "E10158.14.93",
      "E10062.14.93",
      "E10037.18.93",
      "Z99999.99.99",
    ]);
  });
});

describe("filterProductImages", () => {
  it("scarta le immagini decorative sotto la soglia (es. il logo 122x24)", () => {
    const { images } = parsePdftohtmlXml(XML);
    const kept = filterProductImages(images, 50);
    expect(kept.map((i) => i.src)).toEqual(["p-300_1.png", "p-300_2.png", "p-300_3.png"]);
  });
});

describe("mapImagesToCodes", () => {
  it("assegna ogni codice alla foto della sua banda verticale", () => {
    const { images, codes } = parsePdftohtmlXml(XML);
    const map = mapImagesToCodes(filterProductImages(images, 50), codes, { maxFallbackDist: 120 });
    expect(map["E10157.14.93"]).toBe("p-300_1.png"); // banda 125-359
    expect(map["E10158.14.93"]).toBe("p-300_1.png");
    expect(map["E10062.14.93"]).toBe("p-300_2.png"); // banda 384-556
    expect(map["E10037.18.93"]).toBe("p-300_3.png"); // banda 582-845
  });

  it("non mappa i codici troppo lontani da ogni foto", () => {
    const { images, codes } = parsePdftohtmlXml(XML);
    const map = mapImagesToCodes(filterProductImages(images, 50), codes, { maxFallbackDist: 120 });
    // Z99999 è a top 1100: l'ultima foto finisce a 845 → gap ~263 > 120 → non mappato
    expect(map["Z99999.99.99"]).toBeUndefined();
  });

  it("fallback: un codice appena fuori banda va alla foto più vicina entro la soglia", () => {
    const images = [{ top: 100, left: 50, width: 200, height: 200, src: "a.png" }];
    const codes = [{ top: 320, left: 600, width: 60, height: 16, code: "A00001.00.00" }]; // centro 328, banda finisce a 300 → dist 28
    const map = mapImagesToCodes(images, codes, { maxFallbackDist: 120 });
    expect(map["A00001.00.00"]).toBe("a.png");
  });
});
