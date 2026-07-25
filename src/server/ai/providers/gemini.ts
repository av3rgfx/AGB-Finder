import { ProviderHttpError } from "../errors";
import { sseEvents } from "./sse";
import type { ChatMessage, ChatProvider, ChatResult, ProviderChunk, ToolCall, ToolDeclaration } from "./types";

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

function toGeminiRequest(messages: ChatMessage[], tools: ToolDeclaration[]) {
  const systemParts = messages
    .filter((message) => message.role === "system")
    .map((message) => ({ text: message.content }));
  const contents: GeminiContent[] = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    if (message.role === "user") {
      contents.push({ role: "user", parts: [{ text: message.content }] });
    } else if (message.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (message.content) parts.push({ text: message.content });
      for (const call of message.toolCalls ?? [])
        parts.push({ functionCall: { name: call.name, args: call.arguments } });
      contents.push({ role: "model", parts });
    } else {
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: message.toolName,
              response: { result: JSON.parse(message.content) as unknown },
            },
          },
        ],
      });
    }
  }
  return {
    ...(systemParts.length > 0 ? { systemInstruction: { parts: systemParts } } : {}),
    contents,
    ...(tools.length > 0 ? { tools: [{ functionDeclarations: tools }] } : {}),
  };
}

export class GeminiChatProvider implements ChatProvider {
  readonly name = "gemini";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async chat(
    messages: ChatMessage[],
    tools: ToolDeclaration[],
    signal: AbortSignal,
  ): Promise<ChatResult> {
    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(toGeminiRequest(messages, tools)),
        signal,
      },
    );
    if (!response.ok) throw new ProviderHttpError(this.name, response.status);
    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
      usageMetadata?: { totalTokenCount?: number };
    };
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((part) => part.text ?? "").join("") || null;
    const toolCalls: ToolCall[] = parts
      .filter((part) => part.functionCall)
      .map((part, index) => ({
        id: `call_${index}`,
        name: part.functionCall!.name,
        arguments: part.functionCall!.args ?? {},
      }));
    return {
      text,
      toolCalls,
      modelUsed: this.model,
      tokensUsed: payload.usageMetadata?.totalTokenCount ?? null,
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    tools: ToolDeclaration[],
    signal: AbortSignal,
  ): AsyncGenerator<ProviderChunk> {
    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(toGeminiRequest(messages, tools)),
        signal,
      },
    );
    if (!response.ok) throw new ProviderHttpError(this.name, response.status);
    if (!response.body) throw new ProviderHttpError(this.name, 502);
    let toolIndex = 0;
    for await (const data of sseEvents(response.body)) {
      // Alcuni provider terminano lo stream con un sentinel non-JSON (es. "[DONE]"): lo ignoriamo.
      let payload: {
        candidates?: { content?: { parts?: GeminiPart[] } }[];
        usageMetadata?: { totalTokenCount?: number };
      };
      try {
        payload = JSON.parse(data) as typeof payload;
      } catch (error) {
        console.warn("GeminiChatProvider: frame SSE non-JSON ignorato", error);
        continue;
      }
      for (const part of payload.candidates?.[0]?.content?.parts ?? []) {
        if (part.text) yield { type: "text-delta", text: part.text };
        if (part.functionCall)
          yield { type: "tool-call", call: { id: `call_${toolIndex++}`, name: part.functionCall.name, arguments: part.functionCall.args ?? {} } };
      }
      if (payload.usageMetadata?.totalTokenCount != null)
        yield { type: "usage", tokens: payload.usageMetadata.totalTokenCount };
    }
  }
}
