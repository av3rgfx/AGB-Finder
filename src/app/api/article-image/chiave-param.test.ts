import { describe, it, expect } from "vitest";
import { parseChiaveFoto, parseSizeFoto } from "./chiave-param";

describe("parseChiaveFoto", () => {
  it("accetta una chiave del nostro prefisso", () => {
    expect(parseChiaveFoto("maniglie/colombo/01-fedra/fedra-1ol")).toBe(
      "maniglie/colombo/01-fedra/fedra-1ol",
    );
    expect(parseChiaveFoto("maniglie/colombo/03-maniglioni-pulls/id313-rs-45")).toBe(
      "maniglie/colombo/03-maniglioni-pulls/id313-rs-45",
    );
  });

  it("rifiuta tutto ciò che esce dal prefisso", () => {
    for (const bad of [
      null,
      "",
      "listino/page-1",
      "maniglie/colombo/../../listino/page-1",
      "maniglie/colombo/01-fedra/fedra-1ol/extra",
      "maniglie/colombo//fedra-1ol",
      "maniglie/colombo/01-fedra",
      "maniglie/colombo/01-Fedra/fedra-1ol",
      "maniglie/colombo/01-fedra/fedra_1ol",
      "https://altro.example/x",
      " maniglie/colombo/01-fedra/fedra-1ol",
      `maniglie/colombo/01-fedra/${"a".repeat(200)}`,
    ]) {
      expect(parseChiaveFoto(bad), String(bad)).toBeNull();
    }
  });

  it("una nuova riga non fa passare una chiave storta", () => {
    // `$` in JavaScript accetta la fine di riga: senza `\n` nella classe negata,
    // «chiave valida + a capo + qualunque cosa» passerebbe.
    expect(parseChiaveFoto("maniglie/colombo/01-fedra/fedra-1ol\n../listino")).toBeNull();
  });
});

describe("parseSizeFoto", () => {
  it("accetta solo i due formati che lo script genera", () => {
    expect(parseSizeFoto("320")).toBe(320);
    expect(parseSizeFoto("900")).toBe(900);
  });

  it("rifiuta il resto", () => {
    for (const bad of [null, "", "0320", "321", "1200", "abc", " 320"]) {
      expect(parseSizeFoto(bad), String(bad)).toBeNull();
    }
  });
});
