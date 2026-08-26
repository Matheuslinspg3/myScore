import { describe, expect, it } from "vitest";
import {
  isDuplicate,
  transactionFingerprint,
} from "@/lib/finance/deduplication";

describe("transaction fingerprint", () => {
  it("normalizes accents, punctuation and whitespace", () => {
    const base = {
      accountId: "account",
      date: "2026-08-26T10:05:00.000Z",
      amount: -5_590,
    };
    expect(
      transactionFingerprint({
        ...base,
        description: "  NETFLÍX.COM  ",
      }),
    ).toBe(
      transactionFingerprint({
        ...base,
        description: "netflix com",
      }),
    );
  });

  it("prefers the stable external id", () => {
    expect(
      isDuplicate(
        { externalId: "pluggy-1", fingerprint: "new" },
        [{ externalId: "pluggy-1", fingerprint: "old" }],
      ),
    ).toBe(true);
  });

  it("falls back to fingerprint for imports", () => {
    expect(
      isDuplicate(
        { fingerprint: "same" },
        [{ externalId: null, fingerprint: "same" }],
      ),
    ).toBe(true);
  });
});
