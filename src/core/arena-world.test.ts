import { describe, expect, it } from "vitest";

import { createArenaEngine } from "./arena-world";

describe("arena world", () => {
  it("starts empty while exposing the fixed protected platform through context", () => {
    const engine = createArenaEngine();

    expect(engine.getContext().bounds).toEqual({
      minX: -3,
      maxX: 3,
      minY: 0,
      maxY: 6,
      minZ: -3,
      maxZ: 3,
      platformY: 0,
    });
    expect(engine.getSummary()).toMatchObject({
      revision: 0,
      blockCount: 0,
      occupiedBounds: null,
      counts: {
        dirt: 0,
        stone: 0,
        oak_log: 0,
        oak_planks: 0,
        leaves: 0,
        glass: 0,
        obsidian: 0,
      },
    });
    expect(engine.queryBlocks({}).blocks).toEqual([]);
    expect(engine.getSlice({ axis: "y", index: 0 }).cells.flat()).toEqual(
      Array(49).fill(null),
    );
  });

  it("rejects every platform mutation without changing state", () => {
    const edits = [
      { action: "place" as const, position: { x: 0, y: 0, z: 0 }, block: "stone" as const },
      { action: "replace" as const, position: { x: 0, y: 0, z: 0 }, block: "stone" as const },
      { action: "remove" as const, position: { x: 0, y: 0, z: 0 } },
    ];

    for (const edit of edits) {
      const engine = createArenaEngine();
      const result = engine.apply({ type: "set_blocks", expectedRevision: 0, edits: [edit] });

      expect(result).toMatchObject({ success: false, revision: 0, fieldPath: "edits[0].position" });
      expect(engine.getSummary()).toMatchObject({ revision: 0, blockCount: 0 });
    }
  });

  it("keeps the sparse world private and returns immutable block snapshots", () => {
    const engine = createArenaEngine();
    engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{ action: "place", position: { x: 1, y: 2, z: -1 }, block: "glass" }],
    });

    const block = engine.queryBlocks({}).blocks[0];
    expect(block).toEqual({ position: { x: 1, y: 2, z: -1 }, block: "glass" });
    expect(Object.isFrozen(block)).toBe(true);
    expect(Object.isFrozen(block.position)).toBe(true);
  });
});
