import { z } from "zod";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIp(address: string): boolean {
  const normalized = address
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .split("%")[0];
  if (isIP(normalized) === 4) return isPrivateIpv4(normalized);
  if (isIP(normalized) !== 6) return true;
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length));
  }
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

export function validateAiBaseUrl(baseUrl: string): URL {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new AiGatewayError("AI_UNSAFE_BASE_URL");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    (isIP(hostname) > 0 && isPrivateIp(hostname))
  ) {
    throw new AiGatewayError("AI_UNSAFE_BASE_URL");
  }
  return url;
}

async function assertSafeAiEndpoint(endpoint: string): Promise<void> {
  const url = validateAiBaseUrl(endpoint);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname) > 0) return;
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new AiGatewayError("AI_DNS_ERROR");
  }
  if (!addresses.length || addresses.some((item) => isPrivateIp(item.address))) {
    throw new AiGatewayError("AI_UNSAFE_BASE_URL");
  }
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
  await assertSafeAiEndpoint(endpoint);
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
