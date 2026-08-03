/**
 * Tipi lato client per lo streaming SSE della chat — duplicati "a mano" da
 * `src/server/chat/events.ts` / `src/server/chat/products.ts`.
 *
 * Perché la duplicazione: `products.ts` importa `server-only`, ed `events.ts` importa
 * (solo il tipo, ma comunque) `ChatProductSummary` da lì — quindi `events.ts` è
 * server-tainted per transitività. Un `import type` puro verrebbe eraso dal
 * compilatore e non finirebbe nel bundle client, ma è un dettaglio implementativo di
 * `isolatedModules` su cui non vale la pena scommettere: se in futuro uno dei due file
 * aggiungesse anche solo un import di valore, un client component che importasse quei
 * tipi romperebbe silenziosamente la build. Meglio duplicare qui, senza alcun import
 * runtime da `src/server/`. Stesso pattern già in uso in
 * `src/components/chat/product-panel.tsx`.
 */

export interface ChatProductSummary {
  id: string;
  agbCode: string;
  name: string;
  shortDescription: string | null;
  basePrice: number;
  priceUnit: string;
  listinoPage: number | null;
}

export type ChatEvent =
  | { type: "tool"; phase: "start" | "end"; tool: string; label: string; count?: number }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string; products: ChatProductSummary[]; tokens: number }
  | { type: "error"; recoverable: boolean; retryAfter?: number; message: string };
