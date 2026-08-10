import { describe, expect, it } from "vitest";

import { formatElapsed } from "@/app/notifications/study-session-panel";

describe("formatElapsed", () => {
  it("formats sub-hour durations as mm:ss", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(5_000)).toBe("00:05");
    expect(formatElapsed(65_000)).toBe("01:05");
    expect(formatElapsed(59 * 60_000 + 59_000)).toBe("59:59");
  });

  it("switches to h:mm:ss once an hour has elapsed", () => {
    expect(formatElapsed(60 * 60_000)).toBe("1:00:00");
    expect(formatElapsed(2 * 3600_000 + 3 * 60_000 + 4_000)).toBe("2:03:04");
  });

  it("never goes negative for clock skew (started-at slightly in the future)", () => {
    expect(formatElapsed(-500)).toBe("00:00");
  });
});
