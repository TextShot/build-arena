import { describe, expect, it } from "vitest";

import { createArenaConfig } from "./arena-config";
import { createArenaEngine } from "./arena-world";
import { parsePatternDsl } from "./pattern-dsl";

const config = createArenaConfig(11);

describe("pattern DSL", () => {
  it("parses the canonical example into a generate_shape command", () => {
    const result = parsePatternDsl("oak_planks_1@0,1,0-(x5)", config);

    expect(result).toEqual({
      success: true,
      command: {
        type: "generate_shape",
        shape: "filled_box",
        region: { min: { x: -4, y: 1, z: 0 }, max: { x: 0, y: 1, z: 0 } },
        block: "oak_planks",
        objectId: "oak_planks_1",
      },
    });
  });

  it("creates exactly five grouped blocks including the origin", () => {
    const engine = createArenaEngine(createArenaConfig(11));
    const parsed = parsePatternDsl("oak_planks_1@0,1,0-(x5)", engine.getContext().bounds);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const result = engine.apply({ ...parsed.command, expectedRevision: 0 });
    expect(result).toMatchObject({ success: true, affectedBlocks: 5, objectId: "oak_planks_1" });

    const blocks = engine.queryBlocks({}).blocks;
    expect(blocks).toHaveLength(5);
    expect(blocks.map((block) => block.position.x)).toEqual([-4, -3, -2, -1, 0]);
    expect(blocks.every((block) => block.objectId === "oak_planks_1")).toBe(true);
  });

  it("supports positive runs on every axis", () => {
    expect(parsePatternDsl("stone_2@1,2,3+(y3)", createArenaConfig(9))).toMatchObject({
      success: true,
      command: { region: { min: { x: 1, y: 2, z: 3 }, max: { x: 1, y: 4, z: 3 } }, objectId: "stone_2" },
    });
    expect(parsePatternDsl("glass_9@-2,1,-2+(z4)", config)).toMatchObject({
      success: true,
      command: { region: { min: { x: -2, y: 1, z: -2 }, max: { x: -2, y: 1, z: 1 } } },
    });
  });

  it("rejects malformed tokens with field-level errors", () => {
    expect(parsePatternDsl("", config)).toMatchObject({ success: false, fieldPath: "pattern" });
    expect(parsePatternDsl("oak_planks@0,1,0-(x5)", config)).toMatchObject({ success: false, fieldPath: "pattern" });
    expect(parsePatternDsl("wood_1@0,1,0-(x5)", config)).toMatchObject({ success: false, fieldPath: "pattern.block" });
    expect(parsePatternDsl("oak_planks_1@0,1,0-(w5)", config)).toMatchObject({ success: false, fieldPath: "pattern" });
    expect(parsePatternDsl("oak_planks_1@0,1,0-(x0)", config)).toMatchObject({ success: false, fieldPath: "pattern.count" });
  });

  it("rejects stateful blocks, platform hits, and bounds overflow before mutation", () => {
    expect(parsePatternDsl("oak_stairs_1@0,1,0+(x2)", config)).toMatchObject({
      success: false,
      fieldPath: "pattern.block",
    });
    expect(parsePatternDsl("stone_1@0,1,0-(y2)", config)).toMatchObject({
      success: false,
      fieldPath: "pattern.origin",
    });
    expect(parsePatternDsl("stone_1@0,1,0+(x9)", config)).toMatchObject({
      success: false,
      fieldPath: "pattern.count",
    });
  });
});
