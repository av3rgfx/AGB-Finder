/**
 * Plugin remark: rende monospace i codici prodotto AGB (es. A50122, B00590.15.03)
 * ovunque compaiano nel testo "prosa" markdown (paragrafi, liste, celle di tabella…).
 *
 * Perché a livello di albero mdast e non con un componente `text`: `react-markdown`
 * (v10, verificato in questo repo) tipizza `Components` su `keyof JSX.IntrinsicElements`,
 * che NON include `text` — un override `text: (...) => ...` verrebbe ignorato (o rifiutato
 * da TypeScript). La trasformazione avviene quindi qui, PRIMA del rendering, dividendo i
 * nodi mdast di tipo "text" in nodi "text"/"inlineCode" alternati.
 *
 * Perché è sicuro rispetto ai blocchi di codice: i fenced code block (```…```) sono nodi
 * mdast di tipo "code" e gli inline-code (`…`) sono nodi di tipo "inlineCode" — nessuno dei
 * due è un nodo "text" né ha figli (`children`), quindi la visita ricorsiva (che opera solo
 * su `type === "text"` e scende solo dentro nodi con `children`) non li tocca mai: niente
 * doppio wrapping.
 */

/** Codici AGB nel testo (stessa regex di message-bubble.tsx). */
export const AGB_CODE = /\b([A-Z]\d{4,5}(?:\.[0-9A-Z]{2,3})*)\b/g;

/**
 * Nodo mdast minimale: sufficiente per questa trasformazione, senza dipendere da
 * `@types/mdast` — non è una dipendenza diretta del progetto (react-markdown e remark-gfm
 * non la sollevano nel node_modules root sotto pnpm) e la task richiede di non aggiungere
 * dipendenze oltre a `react-markdown`/`remark-gfm`.
 */
export interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
}

/**
 * Divide una stringa in nodi "text"/"inlineCode" alternati sui codici AGB che contiene.
 * Ritorna `null` se non contiene alcun codice AGB (nessuna modifica necessaria).
 * Esportata a parte per essere testata unitariamente.
 */
export function splitAgbText(value: string): MdastNode[] | null {
  const parts = value.split(AGB_CODE);
  if (parts.length === 1) return null;
  const nodes: MdastNode[] = [];
  parts.forEach((part, index) => {
    if (part === "") return;
    nodes.push(index % 2 === 1 ? { type: "inlineCode", value: part } : { type: "text", value: part });
  });
  return nodes;
}

function transform(node: MdastNode): void {
  if (!Array.isArray(node.children)) return;
  const next: MdastNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string") {
      const split = splitAgbText(child.value);
      if (split) {
        next.push(...split);
        continue;
      }
    } else {
      transform(child);
    }
    next.push(child);
  }
  node.children = next;
}

/** Attacher unified/remark: applica la trasformazione all'intero albero mdast. */
export function remarkAgbCode() {
  return (tree: MdastNode) => {
    transform(tree);
  };
}
