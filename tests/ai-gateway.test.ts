import { describe, expect, it } from "vitest";
import {
  AiGatewayError,
  resolveAiEndpoint,
  validateAiBaseUrl,
} from "@/lib/ai/gateway";

describe("AI gateway endpoint", () => {
  it("normaliza gateways OpenAI-compatible", () => {
    expect(resolveAiEndpoint("https://gateway.example", "openai")).toBe(
      "https://gateway.example/v1/chat/completions",
    );
    expect(resolveAiEndpoint("https://gateway.example/v1", "openai")).toBe(
      "https://gateway.example/v1/chat/completions",
    );
    expect(
      resolveAiEndpoint(
        "https://gateway.example/v1/chat/completions",
        "openai",
      ),
    ).toBe("https://gateway.example/v1/chat/completions");
  });

  it("normaliza a API Anthropic", () => {
    expect(resolveAiEndpoint("https://api.anthropic.com", "anthropic")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
  });

  it("aceita somente uma Base URL HTTPS pública", () => {
    expect(validateAiBaseUrl("https://gateway.example/v1").hostname).toBe(
      "gateway.example",
    );
  });

  it.each([
    "http://gateway.example/v1",
    "https://localhost/v1",
    "https://api.localhost/v1",
    "https://127.0.0.1/v1",
    "https://10.0.0.1/v1",
    "https://192.168.1.20/v1",
    "https://[::1]/v1",
    "https://user:password@gateway.example/v1",
  ])("rejeita endpoint inseguro: %s", (endpoint) => {
    expect(() => validateAiBaseUrl(endpoint)).toThrowError(AiGatewayError);
  });
});
