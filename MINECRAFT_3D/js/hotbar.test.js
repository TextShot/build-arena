import { describe, expect, it } from "vitest";

import {
  BLOCKS,
  HOTBAR_IDS,
  heldHotbarLabel,
  hotbarDigitForSlot,
  hotbarSlotForDigit,
} from "./blocks.js";

describe("hotbar digits", () => {
  it("maps 1–9 and 0 onto ten slots", () => {
    expect(hotbarSlotForDigit(1)).toBe(0);
    expect(hotbarSlotForDigit(9)).toBe(8);
    expect(hotbarSlotForDigit(0)).toBe(9);
    expect(hotbarSlotForDigit(10)).toBeNull();
  });

  it("round-trips the ten numbered slots and leaves the Sign clickable", () => {
    expect(HOTBAR_IDS).toHaveLength(11);
    for (let slot = 0; slot < 10; slot++) {
      const digit = hotbarDigitForSlot(slot);
      expect(hotbarSlotForDigit(digit)).toBe(slot);
    }
    expect(HOTBAR_IDS[10]).toBe("oak_sign");
    expect(hotbarDigitForSlot(10)).toBeNull();
  });

  it("puts the key number in brackets after the block name", () => {
    expect(heldHotbarLabel("stone", 0)).toBe("Stone (1)");
    expect(heldHotbarLabel("piston", 9)).toBe(`${BLOCKS.piston.name} (0)`);
    expect(heldHotbarLabel("oak_sign", 10)).toBe("Oak Sign");
  });
});
