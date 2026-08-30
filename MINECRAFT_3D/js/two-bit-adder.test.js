import { describe, expect, it } from "vitest";

import { calculateTwoBitSum } from "./two-bit-adder.js";

describe("calculateTwoBitSum", () => {
  it("returns the three binary output bits for every pair of two-bit inputs", () => {
    const cases = [
      [[0, 0], [0, 0], [0, 0, 0]], [[1, 0], [0, 0], [1, 0, 0]],
      [[0, 1], [0, 0], [0, 1, 0]], [[1, 1], [0, 0], [1, 1, 0]],
      [[0, 0], [1, 0], [1, 0, 0]], [[1, 0], [1, 0], [0, 1, 0]],
      [[0, 1], [1, 0], [1, 1, 0]], [[1, 1], [1, 0], [0, 0, 1]],
      [[0, 0], [0, 1], [0, 1, 0]], [[1, 0], [0, 1], [1, 1, 0]],
      [[0, 1], [0, 1], [0, 0, 1]], [[1, 1], [0, 1], [1, 0, 1]],
      [[0, 0], [1, 1], [1, 1, 0]], [[1, 0], [1, 1], [0, 0, 1]],
      [[0, 1], [1, 1], [1, 0, 1]], [[1, 1], [1, 1], [0, 1, 1]],
    ];

    for (const [[a0, a1], [b0, b1], expected] of cases) {
      expect(calculateTwoBitSum({ a0, a1, b0, b1 })).toEqual(expected);
    }
  });
});
