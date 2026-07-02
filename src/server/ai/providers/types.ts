export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ChatTurn {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: ToolCall[]; // solo assistant
  toolCallId?: string;    // solo tool
  toolName?: string;      // solo tool
  toolOutput?: unknown;   // solo tool
}

export interface ChatCompletion {
  text: string | null;
  toolCalls: ToolCall[];
  tokensUsed: number | null;
}

export interface ChatProvider {
  readonly model: string;
  complete(turns: ChatTurn[], tools: ToolDeclaration[], signal?: AbortSignal): Promise<ChatCompletion>;
}

export class ProviderHttpError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number,
  ) {
    super(`${provider}: HTTP ${status}`);
    this.name = "ProviderHttpError";
  }
}
