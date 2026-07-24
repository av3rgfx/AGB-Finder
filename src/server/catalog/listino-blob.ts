// Helper puri per lo split del listino in pagine singole su Vercel Blob (Opzione B).
// NIENTE `server-only`: usato da scripts/split-listino.ts via tsx.

/**
 * Deriva il template `LISTINO_PAGE_URL_TEMPLATE` dall'URL restituito dall'upload
 * della **pagina 1**: sostituisce `page-1.pdf` (con eventuale query string) con
 * `page-{page}.pdf`. Il numero della pagina non è mai zero-paddato (combacia con
 * `Product.listinoPage`, intero, e con `String(n)` usato dalla route).
 */
export function pageUrlTemplateFromUrl(page1Url: string): string {
  const template = page1Url.replace(/page-1\.pdf(?:\?.*)?$/, "page-{page}.pdf");
  if (!template.includes("{page}")) {
    throw new Error(
      `URL della pagina 1 inatteso (deve terminare con page-1.pdf): ${page1Url}`,
    );
  }
  return template;
}
