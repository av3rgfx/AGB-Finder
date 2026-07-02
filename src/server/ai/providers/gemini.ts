import type { ChatCompletion, ChatProvider, ChatTurn, ToolCall, ToolDeclaration } from "./types";
import { ProviderHttpError } from "./types";

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
  usageMetadata?: { totalTokenCount?: number };
}

function toContents(turns: ChatTurn[]) {
  return turns
    .filter((t) => t.role !== "system")
    .map((t) => {
      if (t.role === "tool") {
        return {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: t.toolName ?? "unknown",
                response: { result: t.toolOutput ?? null },
              },
            },
          ],
        };
      }
      if (t.role === "assistant" && t.toolCalls?.length) {
        return {
          role: "model",
          parts: t.toolCalls.map((c) => ({ functionCall: { name: c.name, args: c.args } })),
        };
      }
      return { role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content ?? "" }] };
    });
}

/** Chat Gemini via REST v1beta. Solo request/response: la resilienza sta nell'AIGateway. */
export class GeminiChatProvider implements ChatProvider {
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async complete(
    turns: ChatTurn[],
    tools: ToolDeclaration[],
    signal?: AbortSignal,
  ): Promise<ChatCompletion> {
    const systemText = turns
      .filter((t) => t.role === "system")
      .map((t) => t.content ?? "")
      .join("\n");
    const body = {
      ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
      contents: toContents(turns),
      ...(tools.length ? { tools: [{ functionDeclarations: tools }] } : {}),
    };
    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
        signal,
      },
    );
    if (!response.ok) throw new ProviderHttpError("gemini", response.status);
    const payload = (await response.json()) as GeminiResponse;
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("") || null;
    const toolCalls: ToolCall[] = parts
      .filter((p) => p.functionCall)
      .map((p, index) => ({
        id: `call_${index}`,
        name: p.functionCall!.name,
        args: p.functionCall!.args ?? {},
      }));
    return { text, toolCalls, tokensUsed: payload.usageMetadata?.totalTokenCount ?? null };
  }
}
