import { describe, expect, it } from "vitest";
import { verifyWebhookSecret } from "@/lib/security/webhook";

describe("webhook authentication", () => {
  it("uses exact constant-time-compatible comparison", () => {
    const secret = "a-very-long-random-webhook-secret";
    expect(verifyWebhookSecret(secret, secret)).toBe(true);
    expect(verifyWebhookSecret(secret + "x", secret)).toBe(false);
    expect(verifyWebhookSecret(null, secret)).toBe(false);
  });
});
