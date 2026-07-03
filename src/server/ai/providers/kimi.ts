import { ProviderHttpError } from "../errors";
import type { ChatMessage, ChatProvider, ChatResult, ToolCall, ToolDeclaration } from "./types";

type KimiMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

function toKimiMessages(messages: ChatMessage[]): KimiMessage[] {
  return messages.map((message): KimiMessage => {
    if (message.role === "assistant") {
      const toolCalls = (message.toolCalls ?? []).map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: JSON.stringify(call.arguments) },
      }));
      return {
        role: "assistant",
        content: message.content,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      };
    }
    if (message.role === "tool")
      return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
    return { role: message.role, content: message.content };
  });
}

function parseArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export class KimiChatProvider implements ChatProvider {
  readonly name = "kimi";

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
    const response = await this.fetchImpl("https://api.moonshot.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: toKimiMessages(messages),
        ...(tools.length > 0
          ? { tools: tools.map((tool) => ({ type: "function", function: tool })) }
          : {}),
      }),
      signal,
    });
    if (!response.ok) throw new ProviderHttpError(this.name, response.status);
    const payload = (await response.json()) as {
      choices?: {
        message?: {
          content?: string | null;
          tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
        };
      }[];
      usage?: { total_tokens?: number };
    };
    const message = payload.choices?.[0]?.message;
    const toolCalls: ToolCall[] = (message?.tool_calls ?? []).map((call, index) => ({
      id: call.id ?? `call_${index}`,
      name: call.function?.name ?? "",
      arguments: parseArguments(call.function?.arguments),
    }));
    return {
      text: message?.content ?? null,
      toolCalls,
      modelUsed: this.model,
      tokensUsed: payload.usage?.total_tokens ?? null,
    };
  }
}
