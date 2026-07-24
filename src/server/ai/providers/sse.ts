import { createParser } from "eventsource-parser";

/** Trasforma un ReadableStream SSE nel flusso dei payload `data:` completi (frame-safe). */
export async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const queue: string[] = [];
  const parser = createParser({ onEvent: (event) => queue.push(event.data) });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) parser.feed(decoder.decode(value, { stream: true }));
      while (queue.length) yield queue.shift()!;
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}
