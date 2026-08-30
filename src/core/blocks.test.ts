import { describe, expect, it } from "vitest";

import { ALL_BLOCK_IDS } from "./block-types";
import { BLOCK_CATALOGUE } from "./blocks";

describe("BLOCK_CATALOGUE", () => {
  it("contains each supported block id exactly once", () => {
    const keys = Object.keys(BLOCK_CATALOGUE);

    expect(keys).toHaveLength(ALL_BLOCK_IDS.length);
    expect(new Set(keys).size).toBe(ALL_BLOCK_IDS.length);
    expect(keys).toEqual([...ALL_BLOCK_IDS]);
  });

  it("uses a catalogue key that matches each entry id", () => {
    for (const [key, entry] of Object.entries(BLOCK_CATALOGUE)) {
      expect(entry.id).toBe(key);
    }
  });
});
