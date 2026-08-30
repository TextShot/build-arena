import { describe, expect, it } from "vitest";

import { PHASE_A_BLOCK_IDS } from "./block-types";
import { BLOCK_CATALOGUE } from "./blocks";

describe("BLOCK_CATALOGUE", () => {
  it("contains each Phase A block id exactly once", () => {
    const keys = Object.keys(BLOCK_CATALOGUE);

    expect(keys).toHaveLength(7);
    expect(new Set(keys).size).toBe(7);
    expect(keys).toEqual([...PHASE_A_BLOCK_IDS]);
  });

  it("uses a catalogue key that matches each entry id", () => {
    for (const [key, entry] of Object.entries(BLOCK_CATALOGUE)) {
      expect(entry.id).toBe(key);
    }
  });
});
