import { describe, it, expect } from "vitest";
import { embeddingText } from "./product-text";

describe("embeddingText", () => {
  it("compone nome, shortDescription e specifiche note", () => {
    expect(
      embeddingText({
        id: "p1",
        name: "COMPACT Nichelato opaco DX",
        shortDescription: "Cerniere · Per porte a filo · ACCIAIO",
        specifications: {
          materiale: "ACCIAIO",
          dimensione: "60 mm",
          finitura: "Nichelato",
          colonne: {},
        },
      }),
    ).toBe(
      "COMPACT Nichelato opaco DX · Cerniere · Per porte a filo · ACCIAIO · ACCIAIO · 60 mm · Nichelato",
    );
  });

  it("ignora campi mancanti o non-stringa", () => {
    expect(
      embeddingText({ id: "p1", name: "X", shortDescription: null, specifications: { materiale: 3 } }),
    ).toBe("X");
  });
});
