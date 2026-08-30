import { describe, expect, it } from "vitest";

import { createArenaEngine } from "./arena-world";

const region = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) => ({
  min: { x: minX, y: minY, z: minZ },
  max: { x: maxX, y: maxY, z: maxZ },
});

describe("generate_shape", () => {
  it("fills a floor atomically with one revision and one history entry", () => {
    const engine = createArenaEngine();
    const result = engine.apply({
      type: "generate_shape",
      expectedRevision: 0,
      shape: "floor",
      region: region(-2, 1, -2, 2, 1, 2),
      block: "oak_planks",
      objectId: "floor_1",
    });

    expect(result).toMatchObject({
      success: true,
      revision: 1,
      affectedBlocks: 25,
      objectId: "floor_1",
    });
    expect(engine.getSummary().counts.oak_planks).toBe(25);

    const undo = engine.apply({ type: "undo", expectedRevision: 1 });
    expect(undo).toMatchObject({ success: true, revision: 2, affectedBlocks: 25 });
    expect(engine.getSummary().blockCount).toBe(0);
  });

  it("builds a hollow box shell only", () => {
    const engine = createArenaEngine();
    const result = engine.apply({
      type: "generate_shape",
      expectedRevision: 0,
      shape: "hollow_box",
      region: region(-1, 1, -1, 1, 3, 1),
      block: "stone",
    });

    // 3x3x3 box minus the single interior cell.
    expect(result).toMatchObject({ success: true, affectedBlocks: 26 });
  });

  it("supports dryRun without mutating anything", () => {
    const engine = createArenaEngine();
    const result = engine.apply({
      type: "generate_shape",
      expectedRevision: 0,
      shape: "filled_box",
      region: region(-1, 1, -1, 1, 2, 1),
      block: "dirt",
      dryRun: true,
    });

    expect(result).toMatchObject({
      success: true,
      revision: 0,
      affectedBlocks: 18,
      warnings: ["Dry run: no blocks were changed"],
      undoId: null,
    });
    expect(engine.getSummary().blockCount).toBe(0);
    expect(engine.getContext().revision).toBe(0);
  });

  it("rejects regions that touch the protected platform or leave the arena", () => {
    const engine = createArenaEngine();
    const platform = engine.apply({
      type: "generate_shape",
      expectedRevision: 0,
      shape: "floor",
      region: region(-1, 0, -1, 1, 0, 1),
      block: "stone",
    });
    const outside = engine.apply({
      type: "generate_shape",
      expectedRevision: 0,
      shape: "floor",
      region: region(-9, 1, 0, 9, 1, 0),
      block: "stone",
    });

    expect(platform).toMatchObject({ success: false, fieldPath: "region.min.y" });
    expect(outside).toMatchObject({ success: false, fieldPath: "region" });
    expect(engine.getSummary().blockCount).toBe(0);
  });

  it("rejects reusing an object group with an incompatible block type", () => {
    const engine = createArenaEngine();
    engine.apply({
      type: "generate_shape",
      expectedRevision: 0,
      shape: "wall",
      region: region(0, 1, -1, 0, 2, 1),
      block: "oak_planks",
      objectId: "wall_1",
    });

    const incompatible = engine.apply({
      type: "generate_shape",
      expectedRevision: 1,
      shape: "wall",
      region: region(1, 1, -1, 1, 2, 1),
      block: "stone",
      objectId: "wall_1",
    });
    const compatible = engine.apply({
      type: "generate_shape",
      expectedRevision: 1,
      shape: "wall",
      region: region(1, 1, -1, 1, 2, 1),
      block: "oak_planks",
      objectId: "wall_1",
    });

    expect(incompatible).toMatchObject({ success: false, fieldPath: "objectId" });
    expect(compatible).toMatchObject({ success: true, revision: 2 });
  });

  it("places stateful partial blocks and preserves state through undo/redo", () => {
    const engine = createArenaEngine();
    const placed = engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{
        action: "place",
        position: { x: 0, y: 1, z: 0 },
        block: "oak_stairs",
        state: { facing: "east", half: "bottom" },
      }],
    });
    expect(placed).toMatchObject({ success: true, revision: 1 });

    engine.apply({ type: "undo", expectedRevision: 1 });
    expect(engine.getSummary().blockCount).toBe(0);
    engine.apply({ type: "redo", expectedRevision: 2 });

    const [block] = engine.queryBlocks({}).blocks;
    expect(block).toMatchObject({
      block: "oak_stairs",
      state: { facing: "east", half: "bottom", shape: "straight" },
    });
  });

  it("rejects state on stateless blocks and missing state on stateful ones", () => {
    const engine = createArenaEngine();
    const statefulCube = engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{ action: "place", position: { x: 0, y: 1, z: 0 }, block: "stone", state: { half: "top" } }],
    });
    const missingState = engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{ action: "place", position: { x: 0, y: 1, z: 0 }, block: "oak_slab" }],
    });

    expect(statefulCube).toMatchObject({ success: false, fieldPath: "edits[0].state" });
    expect(missingState).toMatchObject({ success: false, fieldPath: "edits[0].state" });
  });
});

describe("transform_region", () => {
  it("copies a region and keeps object grouping", () => {
    const engine = createArenaEngine();
    engine.apply({
      type: "generate_shape",
      expectedRevision: 0,
      shape: "wall",
      region: region(-1, 1, 0, -1, 2, 1),
      block: "oak_planks",
      objectId: "wall_1",
    });

    const copy = engine.apply({
      type: "transform_region",
      expectedRevision: 1,
      operation: "copy",
      region: region(-1, 1, 0, -1, 2, 1),
      offset: { x: 2, y: 0, z: 0 },
    });

    expect(copy).toMatchObject({ success: true, revision: 2, affectedBlocks: 4 });
    expect(engine.getSummary().counts.oak_planks).toBe(8);
    expect(engine.queryBlocks({ blockType: "oak_planks" }).blocks.every((block) => block.objectId === "wall_1")).toBe(true);
  });

  it("moves a region and clears the source cells", () => {
    const engine = createArenaEngine();
    engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{ action: "place", position: { x: -2, y: 1, z: 0 }, block: "stone" }],
    });

    const move = engine.apply({
      type: "transform_region",
      expectedRevision: 1,
      operation: "move",
      region: region(-2, 1, 0, -2, 1, 0),
      offset: { x: 4, y: 0, z: 0 },
    });

    expect(move).toMatchObject({ success: true, revision: 2 });
    const blocks = engine.queryBlocks({}).blocks;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].position).toEqual({ x: 2, y: 1, z: 0 });
  });

  it("rotates stairs facing when rotating a region", () => {
    const engine = createArenaEngine();
    engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{
        action: "place",
        position: { x: 0, y: 1, z: 0 },
        block: "oak_stairs",
        state: { facing: "north", half: "bottom" },
      }],
    });

    const rotate = engine.apply({
      type: "transform_region",
      expectedRevision: 1,
      operation: "rotate",
      region: region(0, 1, 0, 0, 1, 0),
      rotation: 90,
    });

    expect(rotate).toMatchObject({ success: true, revision: 2 });
    expect(engine.queryBlocks({}).blocks[0].state).toMatchObject({ facing: "east" });
  });

  it("mirrors facings across the chosen axis", () => {
    const engine = createArenaEngine();
    engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{
        action: "place",
        position: { x: -1, y: 1, z: 0 },
        block: "oak_trapdoor",
        state: { facing: "east", half: "bottom", open: true },
      }],
    });

    const mirror = engine.apply({
      type: "transform_region",
      expectedRevision: 1,
      operation: "mirror",
      region: region(-1, 1, 0, 1, 1, 0),
      axis: "x",
    });

    expect(mirror).toMatchObject({ success: true, revision: 2 });
    const [block] = engine.queryBlocks({}).blocks;
    expect(block.position).toEqual({ x: 1, y: 1, z: 0 });
    expect(block.state).toMatchObject({ facing: "west", open: true });
  });

  it("replaces one block type inside a region", () => {
    const engine = createArenaEngine();
    engine.apply({
      type: "generate_shape",
      expectedRevision: 0,
      shape: "floor",
      region: region(-1, 1, -1, 1, 1, 1),
      block: "dirt",
    });
    engine.apply({
      type: "set_blocks",
      expectedRevision: 1,
      edits: [{ action: "place", position: { x: 0, y: 2, z: 0 }, block: "stone" }],
    });

    const replace = engine.apply({
      type: "transform_region",
      expectedRevision: 2,
      operation: "replace_type",
      region: region(-1, 1, -1, 1, 2, 1),
      from: "dirt",
      to: "obsidian",
    });

    expect(replace).toMatchObject({ success: true, revision: 3, affectedBlocks: 9 });
    expect(engine.getSummary().counts).toMatchObject({ dirt: 0, obsidian: 9, stone: 1 });
  });

  it("fails atomically when a transform would leave the arena", () => {
    const engine = createArenaEngine();
    engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{ action: "place", position: { x: 3, y: 1, z: 0 }, block: "stone" }],
    });

    const result = engine.apply({
      type: "transform_region",
      expectedRevision: 1,
      operation: "copy",
      region: region(3, 1, 0, 3, 1, 0),
      offset: { x: 1, y: 0, z: 0 },
    });

    expect(result).toMatchObject({ success: false, revision: 1, fieldPath: "offset" });
    expect(engine.getSummary().blockCount).toBe(1);
  });
});
