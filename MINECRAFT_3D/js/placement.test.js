import { describe, expect, it } from "vitest";

import { commitPlacement } from "./placement.js";

function createWorld() {
  return {
    radius: 10,
    blocks: new Map(),
    pickCenter: () => ({ placeAt: [2, 0, 3] }),
    place(x, y, z, id) {
      this.blocks.set(`${x},${y},${z}`, { id });
    },
  };
}

describe("commitPlacement", () => {
  it("does not place inventory blocks when manual editing is locked", () => {
    const world = createWorld();
    let blocked = false;

    const result = commitPlacement(world, [{ x: 0, y: 1, z: 0, block: "stone" }], {
      canCommit: () => false,
      onBlocked: () => { blocked = true; },
    });

    expect(result).toEqual({ status: "blocked" });
    expect(blocked).toBe(true);
    expect(world.blocks.size).toBe(0);
  });

  it("places inventory blocks when manual editing is unlocked", () => {
    const world = createWorld();

    const result = commitPlacement(world, [{ x: 0, y: 1, z: 0, block: "stone" }]);

    expect(result).toEqual({ status: "applied", applied: 1 });
    expect(world.blocks.get("2,0,3")).toEqual({ id: "stone" });
  });
});
