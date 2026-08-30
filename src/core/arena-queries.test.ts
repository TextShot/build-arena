import { describe, expect, it } from "vitest";

import { createArenaConfig } from "./arena-config";
import { createArenaEngine } from "./arena-world";

describe("arena queries", () => {
  it("folds material counts and occupied bounds in one summary pass", () => {
    const empty = createArenaEngine().getSummary();
    expect(empty).toMatchObject({ blockCount: 0, occupiedBounds: null });

    const engine = createArenaEngine(createArenaConfig(101, 31));
    engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [
        { action: "place", position: { x: -50, y: 1, z: 50 }, block: "stone" },
        { action: "place", position: { x: 0, y: 17, z: 0 }, block: "stone" },
        { action: "place", position: { x: 50, y: 31, z: -50 }, block: "glass" },
      ],
    });

    expect(engine.getSummary()).toMatchObject({
      blockCount: 3,
      counts: { stone: 2, glass: 1 },
      occupiedBounds: {
        min: { x: -50, y: 1, z: -50 },
        max: { x: 50, y: 31, z: 50 },
      },
    });
  });

  it("sorts blocks by x, then y, then z and paginates deterministically", () => {
    const engine = createArenaEngine();
    engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [
        { action: "place", position: { x: 1, y: 2, z: -1 }, block: "glass" },
        { action: "place", position: { x: -1, y: 3, z: 1 }, block: "dirt" },
        { action: "place", position: { x: -1, y: 1, z: 2 }, block: "stone" },
      ],
    });

    expect(engine.queryBlocks({ limit: 2 }).blocks.map((block) => block.position)).toEqual([
      { x: -1, y: 1, z: 2 },
      { x: -1, y: 3, z: 1 },
    ]);
    expect(engine.queryBlocks({ limit: 2 }).truncated).toBe(true);
    expect(engine.queryBlocks({ limit: 2, offset: 2 })).toMatchObject({
      revision: 1,
      truncated: false,
      blocks: [{ position: { x: 1, y: 2, z: -1 }, block: "glass" }],
    });
  });

  it("filters by region, layer, and block type", () => {
    const engine = createArenaEngine();
    engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [
        { action: "place", position: { x: -2, y: 1, z: -2 }, block: "stone" },
        { action: "place", position: { x: 0, y: 2, z: 0 }, block: "stone" },
        { action: "place", position: { x: 1, y: 1, z: 1 }, block: "glass" },
      ],
    });

    const result = engine.queryBlocks({
      region: { min: { x: -2, y: 1, z: -2 }, max: { x: 0, y: 2, z: 0 } },
      layerY: 1,
      blockType: "stone",
    });
    expect(result.blocks).toEqual([{ position: { x: -2, y: 1, z: -2 }, block: "stone" }]);
  });

  it("returns complete ascending matrices for every slice axis", () => {
    const engine = createArenaEngine();
    engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [
        { action: "place", position: { x: 1, y: 2, z: -1 }, block: "glass" },
        { action: "place", position: { x: -1, y: 3, z: 1 }, block: "dirt" },
      ],
    });

    expect(engine.getSlice({ axis: "y", index: 2 })).toMatchObject({
      rowAxis: "z",
      columnAxis: "x",
      rowCoordinates: [-3, -2, -1, 0, 1, 2, 3],
      columnCoordinates: [-3, -2, -1, 0, 1, 2, 3],
    });
    expect(engine.getSlice({ axis: "y", index: 2 }).cells[2][4]).toBe("glass");
    expect(engine.getSlice({ axis: "x", index: -1 }).cells[3][4]).toBe("dirt");
    expect(engine.getSlice({ axis: "z", index: -1 }).cells[2][4]).toBe("glass");
    expect(engine.getSlice({ axis: "x", index: -1 }).cells[0]).toEqual(Array(7).fill(null));
  });

  it("rejects invalid query bounds, layer, type, pagination, and slice index", () => {
    const engine = createArenaEngine();
    expect(() => engine.queryBlocks({ limit: 0 })).toThrow();
    expect(() => engine.queryBlocks({ limit: 501 })).toThrow();
    expect(() => engine.queryBlocks({ offset: -1 })).toThrow();
    expect(() => engine.queryBlocks({ layerY: 7 })).toThrow();
    expect(() => engine.queryBlocks({ blockType: "not-a-block" as never })).toThrow();
    expect(() => engine.queryBlocks({ region: { min: { x: -4, y: 1, z: -3 }, max: { x: 3, y: 1, z: 3 } } })).toThrow();
    expect(() => engine.getSlice({ axis: "z", index: 8 })).toThrow();
  });
});
