import { describe, expect, it } from "vitest";

import { estimateMessageTokens, estimateTokenCount } from "@/features/ai/usage";

describe("AI usage estimates", () => {
  it("uses a conservative character-based token estimate", () => {
    expect(estimateTokenCount("abcd")).toBe(1);
    expect(estimateTokenCount("abcde")).toBe(2);
    expect(estimateTokenCount("   ")).toBe(1);
  });

  it("adds prompt estimates across provider messages", () => {
    expect(estimateMessageTokens([
      { content: "abcd" },
      { content: "abcdefgh" },
    ])).toBe(3);
  });
});
