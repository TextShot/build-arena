import { describe, expect, it } from "vitest";

import { commitPlacement } from "./placement.js";

function createWorld() {
  return {
    radius: 10,
    blocks: new Map(),
    pickCenter: () => ({ placeAt: [2, 0, 3] }),
    place(x, y, z, id) {
      this.blocks.set(`${x},${y},${z}`, { id });
      return true;
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

    expect(result).toEqual({ status: "applied", applied: 1, skipped: 0 });
    expect(world.blocks.get("2,0,3")).toEqual({ id: "stone" });
  });

  it("reports rejected and out-of-bounds inventory blocks as skipped", () => {
    const world = createWorld();
    const originalPlace = world.place;
    world.place = function place(x, y, z, id) {
      if (id === "glass") return false;
      if (id === "dirt") return 1;
      return originalPlace.call(this, x, y, z, id);
    };

    const result = commitPlacement(world, [
      { x: 0, y: 1, z: 0, block: "stone" },
      { x: 1, y: 1, z: 0, block: "glass" },
      { x: 2, y: 1, z: 0, block: "dirt" },
      { x: 20, y: 1, z: 0, block: "stone" },
    ]);

    expect(result).toEqual({ status: "applied", applied: 1, skipped: 3 });
  });
});
