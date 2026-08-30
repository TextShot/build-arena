import { describe, expect, it } from "vitest";

import { fitSignText } from "./sign-text.js";

describe("fitSignText", () => {
  it("wraps text across at most four sign lines", () => {
    expect(fitSignText("abcdefghijkl", 4, 4).lines).toEqual(["abcd", "efgh", "ijkl"]);
  });

  it("rejects text after the fourth line is full", () => {
    expect(fitSignText("abcdefghijklmnopq", 4, 4)).toEqual({
      text: "abcdefghijklmnop",
      lines: ["abcd", "efgh", "ijkl", "mnop"],
      full: true,
    });
  });
});
