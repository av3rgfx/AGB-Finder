import { describe, it, expect } from "vitest";
import { pageUrlTemplateFromUrl } from "./listino-blob";

describe("pageUrlTemplateFromUrl", () => {
  it("deriva il template dal URL della pagina 1 (placeholder {page})", () => {
    expect(
      pageUrlTemplateFromUrl("https://abc123.public.blob.vercel-storage.com/listino/page-1.pdf"),
    ).toBe("https://abc123.public.blob.vercel-storage.com/listino/page-{page}.pdf");
  });

  it("ignora un'eventuale query string finale", () => {
    expect(
      pageUrlTemplateFromUrl("https://x.public.blob.vercel-storage.com/listino/page-1.pdf?v=2"),
    ).toBe("https://x.public.blob.vercel-storage.com/listino/page-{page}.pdf");
  });

  it("lancia se l'URL non termina con page-1.pdf", () => {
    expect(() => pageUrlTemplateFromUrl("https://x/listino/page-2.pdf")).toThrow();
    expect(() => pageUrlTemplateFromUrl("https://x/listino.pdf")).toThrow();
  });
});
