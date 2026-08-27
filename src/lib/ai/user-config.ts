import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AiGatewayError,
  getAiConfig,
  type AiApiFormat,
  type AiAuthScheme,
  type AiConfig,
} from "@/lib/ai/gateway";

interface AiCredentialRow {
  owner_id: string;
  enabled: boolean;
  api_format: AiApiFormat;
  auth_scheme: AiAuthScheme;
  base_url: string;
  api_key_ciphertext: string;
  chat_model: string;
  data_model: string;
}

export interface AiSettingsInput {
  enabled: boolean;
  apiFormat: AiApiFormat;
  authScheme: AiAuthScheme;
  baseUrl: string;
  apiKey?: string;
  chatModel: string;
  dataModel: string;
}

export interface AiSettingsStatus {
  source: "dashboard" | "environment" | "none";
  configured: boolean;
  enabled: boolean;
  apiKeyConfigured: boolean;
  apiFormat: AiApiFormat;
  authScheme: AiAuthScheme;
  baseUrl: string;
  chatModel: string;
  dataModel: string;
}

export class AiSettingsError extends Error {
  constructor(
    message: string,
    public readonly databaseCode?: string,
  ) {
    super(message);
    this.name = "AiSettingsError";
  }
}

export function isAiSettingsMigrationMissing(error: unknown): boolean {
  return (
    error instanceof AiSettingsError &&
    ["42P01", "PGRST204", "PGRST205"].includes(error.databaseCode ?? "")
  );
}

function encryptionRootSecret(): string {
  const secret =
    process.env.AI_SETTINGS_ENCRYPTION_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || secret.length < 20) {
    throw new AiSettingsError("AI_ENCRYPTION_KEY_MISSING");
  }
  return secret;
}

function deriveEncryptionKey(rootSecret: string): Buffer {
  return createHash("sha256")
    .update("myscore:ai-credentials:v1\0")
    .update(rootSecret)
    .digest();
}

export function encryptAiApiKey(apiKey: string, rootSecret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    deriveEncryptionKey(rootSecret),
    iv,
  );
  const encrypted = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptAiApiKey(payload: string, rootSecret: string): string {
  const [version, ivPart, tagPart, encryptedPart] = payload.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !encryptedPart) {
    throw new AiSettingsError("AI_CREDENTIALS_UNREADABLE");
  }
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveEncryptionKey(rootSecret),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new AiSettingsError("AI_CREDENTIALS_UNREADABLE");
  }
}

async function loadCredentialRow(
  ownerId: string,
): Promise<AiCredentialRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_credentials")
    .select(
      "owner_id, enabled, api_format, auth_scheme, base_url, api_key_ciphertext, chat_model, data_model",
    )
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) {
    throw new AiSettingsError("AI_SETTINGS_DATABASE_ERROR", error.code);
  }
  return data as AiCredentialRow | null;
}

function configFromRow(row: AiCredentialRow): AiConfig {
  if (!row.enabled) throw new AiGatewayError("AI_NOT_CONFIGURED");
  return {
    baseUrl: row.base_url,
    apiKey: decryptAiApiKey(
      row.api_key_ciphertext,
      encryptionRootSecret(),
    ),
    apiFormat: row.api_format,
    authScheme: row.auth_scheme,
    chatModel: row.chat_model,
    dataModel: row.data_model,
  };
}

export async function getUserAiConfig(ownerId: string): Promise<AiConfig> {
  let row: AiCredentialRow | null;
  try {
    row = await loadCredentialRow(ownerId);
  } catch (error) {
    if (isAiSettingsMigrationMissing(error)) return getAiConfig();
    throw error;
  }
  if (row) return configFromRow(row);
  return getAiConfig();
}

export async function getUserAiSettingsStatus(
  ownerId: string,
): Promise<AiSettingsStatus> {
  const row = await loadCredentialRow(ownerId);
  if (row) {
    let readable = true;
    try {
      decryptAiApiKey(row.api_key_ciphertext, encryptionRootSecret());
    } catch {
      readable = false;
    }
    return {
      source: "dashboard",
      configured: readable,
      enabled: row.enabled && readable,
      apiKeyConfigured: readable,
      apiFormat: row.api_format,
      authScheme: row.auth_scheme,
      baseUrl: row.base_url,
      chatModel: row.chat_model,
      dataModel: row.data_model,
    };
  }

  try {
    const config = getAiConfig();
    return {
      source: "environment",
      configured: true,
      enabled: true,
      apiKeyConfigured: true,
      apiFormat: config.apiFormat,
      authScheme: config.authScheme,
      baseUrl: config.baseUrl,
      chatModel: config.chatModel,
      dataModel: config.dataModel,
    };
  } catch {
    return {
      source: "none",
      configured: false,
      enabled: false,
      apiKeyConfigured: false,
      apiFormat: "openai",
      authScheme: "bearer",
      baseUrl: "",
      chatModel: "claude-sonnet-5",
      dataModel: "claude-opus-5",
    };
  }
}

async function apiKeyForSave(
  input: AiSettingsInput,
  current: AiCredentialRow | null,
): Promise<string> {
  const supplied = input.apiKey?.trim();
  if (supplied) return supplied;
  if (current) {
    return decryptAiApiKey(
      current.api_key_ciphertext,
      encryptionRootSecret(),
    );
  }
  try {
    return getAiConfig().apiKey;
  } catch {
    throw new AiSettingsError("AI_API_KEY_REQUIRED");
  }
}

export async function buildUserAiConfig(
  ownerId: string,
  input: AiSettingsInput,
): Promise<AiConfig> {
  const current = await loadCredentialRow(ownerId);
  return {
    baseUrl: input.baseUrl,
    apiKey: await apiKeyForSave(input, current),
    apiFormat: input.apiFormat,
    authScheme: input.authScheme,
    chatModel: input.chatModel,
    dataModel: input.dataModel,
  };
}

export async function saveUserAiSettings(
  ownerId: string,
  input: AiSettingsInput,
): Promise<AiSettingsStatus> {
  const config = await buildUserAiConfig(ownerId, input);
  const admin = createAdminClient();
  const { error } = await admin.from("ai_credentials").upsert({
    owner_id: ownerId,
    enabled: input.enabled,
    provider: "custom",
    api_format: input.apiFormat,
    auth_scheme: input.authScheme,
    base_url: input.baseUrl,
    api_key_ciphertext: encryptAiApiKey(
      config.apiKey,
      encryptionRootSecret(),
    ),
    chat_model: input.chatModel,
    data_model: input.dataModel,
  });
  if (error) {
    throw new AiSettingsError("AI_SETTINGS_DATABASE_ERROR", error.code);
  }

  const { error: settingsError } = await admin
    .from("settings")
    .update({ ai_enabled: input.enabled })
    .eq("owner_id", ownerId);
  if (settingsError) {
    throw new AiSettingsError(
      "AI_SETTINGS_DATABASE_ERROR",
      settingsError.code,
    );
  }
  return getUserAiSettingsStatus(ownerId);
}
