import { describe, expect, it } from "vitest";
import { resolveAiEndpoint } from "@/lib/ai/gateway";

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
});
