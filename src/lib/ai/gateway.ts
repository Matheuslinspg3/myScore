import { z } from "zod";

export type AiApiFormat = "openai" | "anthropic";
export type AiAuthScheme = "bearer" | "x-api-key";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  apiFormat: AiApiFormat;
  authScheme: AiAuthScheme;
  chatModel: string;
  dataModel: string;
}

const aiConfigSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(8),
  apiFormat: z.enum(["openai", "anthropic"]),
  authScheme: z.enum(["bearer", "x-api-key"]),
  chatModel: z.string().trim().min(1),
  dataModel: z.string().trim().min(1),
});

export class AiGatewayError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

export function getAiConfig(): AiConfig {
  if (process.env.AI_PROVIDER !== "custom") {
    throw new AiGatewayError("AI_NOT_CONFIGURED");
  }

  const legacyModel = process.env.AI_MODEL;
  return aiConfigSchema.parse({
    baseUrl: process.env.AI_BASE_URL,
    apiKey: process.env.AI_API_KEY,
    apiFormat: process.env.AI_API_FORMAT ?? "openai",
    authScheme: process.env.AI_AUTH_SCHEME ?? "bearer",
    chatModel: process.env.AI_CHAT_MODEL ?? legacyModel,
    dataModel: process.env.AI_DATA_MODEL ?? legacyModel,
  });
}

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function resolveAiEndpoint(
  baseUrl: string,
  apiFormat: AiApiFormat,
): string {
  const base = withoutTrailingSlash(baseUrl);
  if (apiFormat === "anthropic") {
    if (base.endsWith("/messages")) return base;
    if (base.endsWith("/v1")) return base + "/messages";
    return base + "/v1/messages";
  }
  if (base.endsWith("/chat/completions")) return base;
  if (base.endsWith("/v1")) return base + "/chat/completions";
  return base + "/v1/chat/completions";
}

function authHeaders(config: AiConfig): Record<string, string> {
  if (config.authScheme === "x-api-key") {
    return { "x-api-key": config.apiKey };
  }
  return { Authorization: "Bearer " + config.apiKey };
}

function extractText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return null;
  const parts = value
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const candidate = part as { text?: unknown; content?: unknown };
      if (typeof candidate.text === "string") return candidate.text;
      if (typeof candidate.content === "string") return candidate.content;
      return "";
    })
    .filter(Boolean);
  return parts.length ? parts.join("\n") : null;
}

function responseText(payload: unknown, format: AiApiFormat): string | null {
  if (!payload || typeof payload !== "object") return null;
  if (format === "anthropic") {
    return extractText((payload as { content?: unknown }).content);
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") {
    return null;
  }
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  return extractText((message as { content?: unknown }).content);
}

export async function generateAiText({
  config,
  model,
  system,
  messages,
  maxTokens = 1800,
  temperature = 0.2,
}: {
  config: AiConfig;
  model: string;
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const endpoint = resolveAiEndpoint(config.baseUrl, config.apiFormat);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeaders(config),
  };

  let body: Record<string, unknown>;
  if (config.apiFormat === "anthropic") {
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model,
      system,
      messages,
      max_tokens: maxTokens,
      temperature,
    };
  } else {
    body = {
      model,
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens: maxTokens,
      temperature,
      stream: false,
    };
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(50_000),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "AI_TIMEOUT"
        : "AI_UNREACHABLE";
    throw new AiGatewayError(message);
  }

  if (!response.ok) {
    throw new AiGatewayError("AI_UPSTREAM_ERROR", response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AiGatewayError("AI_INVALID_RESPONSE", response.status);
  }
  const text = responseText(payload, config.apiFormat)?.trim();
  if (!text) throw new AiGatewayError("AI_EMPTY_RESPONSE", response.status);
  return text;
}
