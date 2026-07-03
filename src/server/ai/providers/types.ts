/** Chiamata tool richiesta dal modello. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Dichiarazione tool: JSON Schema dei parametri (formato comune Gemini/OpenAI). */
export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Messaggio del transcript, indipendente dal provider. Il content del tool è l'output JSON stringificato. */
export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; toolName: string; content: string };

export interface ChatResult {
  text: string | null;
  toolCalls: ToolCall[];
  modelUsed: string;
  tokensUsed: number | null;
}

/** Solo costruzione richiesta + parsing risposta: la resilienza sta nel gateway. */
export interface ChatProvider {
  readonly name: string;
  chat(messages: ChatMessage[], tools: ToolDeclaration[], signal: AbortSignal): Promise<ChatResult>;
}
