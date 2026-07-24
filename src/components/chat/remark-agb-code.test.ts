import { describe, it, expect } from "vitest";
import { splitAgbText, remarkAgbCode, type MdastNode } from "./remark-agb-code";

describe("splitAgbText", () => {
  it("ritorna null se non ci sono codici AGB", () => {
    expect(splitAgbText("nessun codice qui")).toBeNull();
  });

  it("divide un codice AGB semplice in text/inlineCode/text", () => {
    expect(splitAgbText("vedi A50122 per favore")).toEqual([
      { type: "text", value: "vedi " },
      { type: "inlineCode", value: "A50122" },
      { type: "text", value: " per favore" },
    ]);
  });

  it("gestisce un codice AGB con suffissi puntati", () => {
    expect(splitAgbText("codice B00590.15.03 disponibile")).toEqual([
      { type: "text", value: "codice " },
      { type: "inlineCode", value: "B00590.15.03" },
      { type: "text", value: " disponibile" },
    ]);
  });

  it("gestisce più codici nello stesso testo", () => {
    expect(splitAgbText("A50122 e A50123")).toEqual([
      { type: "inlineCode", value: "A50122" },
      { type: "text", value: " e " },
      { type: "inlineCode", value: "A50123" },
    ]);
  });

  it("gestisce un testo che È interamente un codice AGB (nessun text vuoto residuo)", () => {
    expect(splitAgbText("A50122")).toEqual([{ type: "inlineCode", value: "A50122" }]);
  });

  it("non wrappa parole che assomigliano ma non rispettano il pattern (minuscole)", () => {
    expect(splitAgbText("questo non è un codice: a50122")).toBeNull();
  });
});

describe("remarkAgbCode (trasformazione dell'albero mdast)", () => {
  const run = (tree: MdastNode) => {
    remarkAgbCode()(tree);
    return tree;
  };

  it("divide i nodi text dentro un paragrafo", () => {
    const tree: MdastNode = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "consiglio la A50122 per l'anta" }],
        },
      ],
    };
    run(tree);
    expect(tree.children?.[0]?.children).toEqual([
      { type: "text", value: "consiglio la " },
      { type: "inlineCode", value: "A50122" },
      { type: "text", value: " per l'anta" },
    ]);
  });

  it("scende in profondità (liste, celle di tabella) ma non tocca nodi senza children", () => {
    const tree: MdastNode = {
      type: "root",
      children: [
        {
          type: "list",
          children: [
            {
              type: "listItem",
              children: [{ type: "paragraph", children: [{ type: "text", value: "vedi A50122" }] }],
            },
          ],
        },
        // nodo "code" (blocco fenced): ha `value`, non `children` — non deve essere toccato.
        { type: "code", value: "A50122 nel blocco di codice" },
        // nodo "inlineCode" già esistente: non deve essere ri-wrappato.
        { type: "inlineCode", value: "A50122" },
      ],
    };
    run(tree);
    const listItemParagraph = tree.children?.[0]?.children?.[0]?.children?.[0];
    expect(listItemParagraph?.children).toEqual([
      { type: "text", value: "vedi " },
      { type: "inlineCode", value: "A50122" },
    ]);
    // il nodo "code" resta invariato (nessun campo children aggiunto)
    expect(tree.children?.[1]).toEqual({ type: "code", value: "A50122 nel blocco di codice" });
    // il nodo "inlineCode" pre-esistente resta invariato (un solo livello, non duplicato)
    expect(tree.children?.[2]).toEqual({ type: "inlineCode", value: "A50122" });
  });
});
