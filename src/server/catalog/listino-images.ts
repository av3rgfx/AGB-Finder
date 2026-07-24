// Helper puri per l'estrazione delle foto prodotto dal listino PDF (feature
// «immagini prodotto»). Deterministico, MAI LLM. Riusato dallo script ops via tsx —
// NIENTE `server-only`.
//
// L'input è l'XML di `pdftohtml -xml -fmt png`, che dà bounding-box (in punti di
// layout) sia delle immagini (`<image ... src>`) sia del testo (`<text ...>…</text>`).
// La mappatura sfrutta il layout tipico del listino: la foto e i codici che
// illustra stanno sulla stessa BANDA verticale.

/** Codice AGB: lettera + 5 cifre + .NN.NN. */
const CODE_TOKEN = /[A-Z]\d{5}\.\d{2}\.\d{2}/;

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}
export interface ImageBox extends Box {
  src: string;
}
export interface CodeBox extends Box {
  code: string;
}

function numAttr(tag: string, name: string): number | null {
  const m = new RegExp(`\\b${name}="(-?\\d+)"`).exec(tag);
  return m ? Number(m[1]) : null;
}

function box(tag: string): Box | null {
  const top = numAttr(tag, "top");
  const left = numAttr(tag, "left");
  const width = numAttr(tag, "width");
  const height = numAttr(tag, "height");
  if (top == null || left == null || width == null || height == null) return null;
  return { top, left, width, height };
}

/** Parsa l'XML di pdftohtml → immagini (con src) e codici (dai `<text>`). */
export function parsePdftohtmlXml(xml: string): { images: ImageBox[]; codes: CodeBox[] } {
  const images: ImageBox[] = [];
  for (const m of xml.matchAll(/<image\b[^>]*\/?>/g)) {
    const b = box(m[0]);
    const src = /\bsrc="([^"]+)"/.exec(m[0]);
    if (b && src) images.push({ ...b, src: src[1]! });
  }

  const codes: CodeBox[] = [];
  for (const m of xml.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const b = box(`<text ${m[1]}>`);
    if (!b) continue;
    const text = m[2]!.replace(/<[^>]*>/g, "");
    const code = CODE_TOKEN.exec(text);
    if (code) codes.push({ ...b, code: code[0] });
  }
  return { images, codes };
}

/** Tiene solo le immagini «prodotto»: scarta il decorativo (strisce, loghi) sotto la soglia. */
export function filterProductImages(images: ImageBox[], minSide: number): ImageBox[] {
  return images.filter((i) => i.width >= minSide && i.height >= minSide);
}

/**
 * Mappa ogni codice alla foto della sua banda verticale (deterministico).
 * Preferenza: la foto la cui banda [top, top+height] contiene il centro verticale
 * del codice; a parità, la più vicina di centro. Fallback: la foto più vicina
 * entro `maxFallbackDist` punti. Nessuna foto adatta → codice non mappato.
 * Ritorna `{ agbCode: src }` (più codici possono condividere la stessa foto).
 */
export function mapImagesToCodes(
  images: ImageBox[],
  codes: CodeBox[],
  opts?: { maxFallbackDist?: number },
): Record<string, string> {
  const maxDist = opts?.maxFallbackDist ?? 80;
  const out: Record<string, string> = {};
  for (const c of codes) {
    const cy = c.top + c.height / 2;
    let best: ImageBox | null = null;
    let bestScore = Infinity;
    for (const img of images) {
      // Distanza dalla BANDA verticale della foto: 0 se il codice è dentro,
      // altrimenti quanto dista dal bordo più vicino della banda.
      const gap = Math.max(0, img.top - cy, cy - (img.top + img.height));
      if (gap > maxDist) continue;
      // La vicinanza alla banda domina; il centro fa da spareggio (bande sovrapposte).
      const score = gap * 1000 + Math.abs(cy - (img.top + img.height / 2));
      if (score < bestScore) {
        bestScore = score;
        best = img;
      }
    }
    if (best) out[c.code] = best.src;
  }
  return out;
}
