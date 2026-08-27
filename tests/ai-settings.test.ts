import { describe, expect, it } from "vitest";
import {
  AiSettingsError,
  decryptAiApiKey,
  encryptAiApiKey,
} from "@/lib/ai/user-config";

const rootSecret = "service-role-secret-with-enough-entropy-for-tests";

describe("AI settings encryption", () => {
  it("criptografa e recupera a chave sem perda", () => {
    const encrypted = encryptAiApiKey("sk-private-test-key", rootSecret);

    expect(encrypted).not.toContain("sk-private-test-key");
    expect(decryptAiApiKey(encrypted, rootSecret)).toBe("sk-private-test-key");
  });

  it("usa um nonce novo em cada gravação", () => {
    const first = encryptAiApiKey("sk-private-test-key", rootSecret);
    const second = encryptAiApiKey("sk-private-test-key", rootSecret);

    expect(first).not.toBe(second);
  });

  it("rejeita segredo incorreto ou conteúdo adulterado", () => {
    const encrypted = encryptAiApiKey("sk-private-test-key", rootSecret);
    const tampered = encrypted.slice(0, -1) + (encrypted.endsWith("a") ? "b" : "a");

    expect(() => decryptAiApiKey(encrypted, "another-long-root-secret"))
      .toThrowError(AiSettingsError);
    expect(() => decryptAiApiKey(tampered, rootSecret)).toThrowError(
      AiSettingsError,
    );
  });
});
