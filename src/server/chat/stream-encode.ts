import type { ChatEvent } from "./events";

/** Codifica un ChatEvent come frame SSE (`data: <json>\n\n`). */
export function encodeSSE(event: ChatEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
