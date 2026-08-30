import { describe, expect, it } from "vitest";

import { World } from "./world.js";

describe("World structural revisions", () => {
  it("assigns a new revision every time the same cell changes", () => {
    const world = { blockRevisions: new Map(), nextBlockRevision: 1 };

    World.prototype._markBlockChanged.call(world, "1,2,3");
    expect(world.blockRevisions.get("1,2,3")).toBe(1);
    World.prototype._markBlockChanged.call(world, "1,2,3");
    expect(world.blockRevisions.get("1,2,3")).toBe(2);
  });
});
