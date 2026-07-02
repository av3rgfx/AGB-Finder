import type { ChatCompletion, ChatProvider, ChatTurn, ToolCall, ToolDeclaration } from "./types";
import { ProviderHttpError } from "./types";

interface KimiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
interface KimiResponse {
  choices?: { message?: { content?: string | null; tool_calls?: KimiToolCall[] } }[];
  usage?: { total_tokens?: number };
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toMessages(turns: ChatTurn[]) {
  return turns.map((t) => {
    if (t.role === "tool") {
      return { role: "tool", tool_call_id: t.toolCallId ?? "", content: JSON.stringify(t.toolOutput ?? null) };
    }
    if (t.role === "assistant" && t.toolCalls?.length) {
      return {
        role: "assistant",
        content: t.content ?? "",
        tool_calls: t.toolCalls.map((c) => ({
          id: c.id,
          type: "function" as const,
          function: { name: c.name, arguments: JSON.stringify(c.args) },
        })),
      };
    }
    return { role: t.role, content: t.content ?? "" };
  });
}

/** Chat Kimi/Moonshot (API OpenAI-compatible). Solo request/response. */
export class KimiChatProvider implements ChatProvider {
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl = "https://api.moonshot.ai/v1",
  ) {}

  async complete(
    turns: ChatTurn[],
    tools: ToolDeclaration[],
    signal?: AbortSignal,
  ): Promise<ChatCompletion> {
    const body = {
      model: this.model,
      messages: toMessages(turns),
      ...(tools.length
        ? { tools: tools.map((t) => ({ type: "function" as const, function: t })) }
        : {}),
    };
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) throw new ProviderHttpError("kimi", response.status);
    const payload = (await response.json()) as KimiResponse;
    const message = payload.choices?.[0]?.message;
    const toolCalls: ToolCall[] = (message?.tool_calls ?? []).map((c) => ({
      id: c.id,
      name: c.function.name,
      args: parseArgs(c.function.arguments),
    }));
    return {
      text: message?.content ?? null,
      toolCalls,
      tokensUsed: payload.usage?.total_tokens ?? null,
    };
  }
}
