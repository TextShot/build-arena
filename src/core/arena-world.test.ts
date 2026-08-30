import { describe, expect, it } from "vitest";

import type { BlockEdit } from "./arena-engine";
import { createArenaConfig } from "./arena-config";
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

  it("resizes to odd platform widths through 101 without visual-only cells", () => {
    const engine = createArenaEngine();
    const changes: unknown[] = [];
    engine.subscribe((change) => changes.push(change));

    expect(engine.resizePlatform(101)).toMatchObject({ success: true, revision: 1 });
    expect(changes).toEqual([
      expect.objectContaining({ commandType: "resize_platform", revision: 1, affectedBlocks: 0 }),
    ]);
    expect(engine.getContext().bounds).toMatchObject({ minX: -50, maxX: 50, minZ: -50, maxZ: 50 });
    expect(engine.apply({
      type: "set_blocks",
      expectedRevision: 1,
      edits: [{ action: "place", position: { x: 50, y: 1, z: 50 }, block: "stone" }],
    })).toMatchObject({ success: true, revision: 2 });
    expect(engine.apply({
      type: "set_blocks",
      expectedRevision: 2,
      edits: [{ action: "place", position: { x: 51, y: 1, z: 50 }, block: "stone" }],
    })).toMatchObject({ success: false, revision: 2 });
  });

  it("rejects invalid or destructive platform shrinking atomically", () => {
    const engine = createArenaEngine();
    engine.resizePlatform(9);
    engine.apply({
      type: "set_blocks",
      expectedRevision: 1,
      edits: [{ action: "place", position: { x: 4, y: 1, z: 0 }, block: "glass" }],
    });

    expect(engine.resizePlatform(8)).toMatchObject({ success: false, revision: 2 });
    expect(engine.resizePlatform(7)).toMatchObject({ success: false, revision: 2 });
    expect(engine.getContext().bounds).toMatchObject({ minX: -4, maxX: 4, minZ: -4, maxZ: 4 });
    expect(engine.queryBlocks({ limit: 500 }).blocks).toHaveLength(1);
  });

  it("keeps block undo history when the platform expands", () => {
    const engine = createArenaEngine();
    engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{ action: "place", position: { x: 0, y: 1, z: 0 }, block: "stone" }],
    });

    engine.resizePlatform(9);
    expect(engine.apply({ type: "undo", expectedRevision: 2 })).toMatchObject({
      success: true,
      revision: 3,
    });
    expect(engine.getSummary().blockCount).toBe(0);
  });

  it("snapshots every block beyond the public query page limit", () => {
    const engine = createArenaEngine();
    engine.resizePlatform(101);
    const edits: BlockEdit[] = [];
    for (let z = -2; z <= 2; z += 1) {
      for (let x = -50; x <= 50; x += 1) {
        edits.push({ action: "place", position: { x, y: 1, z }, block: "stone" });
      }
    }
    engine.apply({ type: "set_blocks", expectedRevision: 1, edits: edits.slice(0, 256) });
    engine.apply({ type: "set_blocks", expectedRevision: 2, edits: edits.slice(256) });

    expect(engine.snapshotBlocks()).toHaveLength(505);
  });

  it("uses explicit 51×51×31 bounds and accepts the top build layer", () => {
    const engine = createArenaEngine(createArenaConfig(51, 7));
    const changes: unknown[] = [];
    engine.subscribe((change) => changes.push(change));

    expect(engine.resizeHeight(31)).toMatchObject({ success: true, revision: 1 });
    expect(engine.getContext().bounds).toMatchObject({
      minX: -25,
      maxX: 25,
      maxY: 31,
      minZ: -25,
      maxZ: 25,
    });
    expect(changes).toEqual([
      expect.objectContaining({ commandType: "resize_height", revision: 1 }),
    ]);
    expect(engine.apply({
      type: "set_blocks",
      expectedRevision: 1,
      edits: [{ action: "place", position: { x: 0, y: 31, z: 0 }, block: "stone" }],
    })).toMatchObject({ success: true, revision: 2 });
    expect(engine.apply({
      type: "set_blocks",
      expectedRevision: 2,
      edits: [{ action: "place", position: { x: 0, y: 32, z: 0 }, block: "stone" }],
    })).toMatchObject({ success: false, revision: 2 });
  });

  it("rejects height shrinking around existing upper blocks", () => {
    const engine = createArenaEngine(createArenaConfig(51, 31));
    const changes: unknown[] = [];
    engine.subscribe((change) => changes.push(change));
    engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{ action: "place", position: { x: 0, y: 31, z: 0 }, block: "glass" }],
    });

    expect(engine.resizeHeight(29)).toMatchObject({ success: false, revision: 1 });
    expect(engine.getContext().bounds.maxY).toBe(31);
    expect(changes).toHaveLength(1);
  });
});
