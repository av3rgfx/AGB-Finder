import type { ChatProductSummary } from "./products";

/** Eventi SSE emessi da ChatService.generateStream, uno per riga verso il client. */
export type ChatEvent =
  | { type: "tool"; phase: "start" | "end"; tool: string; label: string; count?: number }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string; products: ChatProductSummary[]; tokens: number }
  | { type: "error"; recoverable: boolean; retryAfter?: number; message: string };

const LABELS: Record<string, string> = {
  search_products: "Sto cercando nel catalogo…",
  get_product_by_code: "Sto recuperando la scheda…",
};

export function toolLabel(name: string): string {
  return LABELS[name] ?? "Sto consultando il catalogo…";
}
