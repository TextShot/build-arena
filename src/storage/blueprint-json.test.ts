import { describe, expect, it } from "vitest";

import { createArenaConfig } from "../core/arena-config";
import { createBlueprint } from "../core/blueprint";
import { parseBlueprintJson, serializeBlueprintJson } from "./blueprint-json";

describe("blueprint JSON", () => {
  it("round-trips a valid version-1 blueprint", () => {
    const blueprint = createBlueprint(
      [{ position: { x: 0, y: 1, z: 0 }, block: "oak_planks" }],
      { id: "starter", name: "Starter" },
    );

    expect(parseBlueprintJson(serializeBlueprintJson(blueprint))).toEqual({
      success: true,
      blueprint,
    });
  });

  it("rejects malformed JSON with a useful location", () => {
    const result = parseBlueprintJson('{\n  "schemaVersion": 1,\n  "blocks": [\n}');

    expect(result).toMatchObject({ success: false });
    expect(result.success || result.error).toMatch(/JSON|position|line/i);
  });

  it("rejects duplicate, protected, or out-of-bounds coordinates before engine mutation", () => {
    const blueprint = createBlueprint(
      [{ position: { x: 0, y: 1, z: 0 }, block: "stone" }],
      { id: "duplicate", name: "Duplicate" },
    );
    const unsafe = {
      ...blueprint,
      blocks: [
        ...blueprint.blocks,
        { position: { x: 0, y: 1, z: 0 }, block: "glass" },
      ],
    };

    expect(parseBlueprintJson(JSON.stringify(unsafe))).toMatchObject({
      success: false,
      fieldPath: "blocks[1].position",
    });

    const platform = {
      ...blueprint,
      blocks: [{ position: { x: 0, y: 0, z: 0 }, block: "stone" }],
    };
    expect(parseBlueprintJson(JSON.stringify(platform))).toMatchObject({
      success: false,
      fieldPath: "blocks[0].position",
    });

    const outOfBounds = {
      ...blueprint,
      blocks: [{ position: { x: 4, y: 1, z: 0 }, block: "stone" }],
    };
    expect(parseBlueprintJson(JSON.stringify(outOfBounds))).toMatchObject({
      success: false,
    });
    expect(parseBlueprintJson(JSON.stringify(outOfBounds), createArenaConfig(9))).toMatchObject({
      success: true,
    });
  });

  it("imports a version-1 full-cube blueprint through the documented migration", () => {
    const v1 = {
      schemaVersion: 1,
      id: "legacy-house",
      name: "Legacy House",
      size: { x: 1, y: 1, z: 1 },
      anchor: { x: 0, y: 0, z: 0 },
      blocks: [{ position: { x: 0, y: 1, z: 0 }, block: "stone" }],
      blockSummary: { dirt: 0, stone: 1, oak_log: 0, oak_planks: 0, leaves: 0, glass: 0, obsidian: 0 },
      validation: { errors: 0, warnings: ["legacy warning"] },
      preview: { view: "isometric" },
    };

    const result = parseBlueprintJson(JSON.stringify(v1));
    expect(result).toMatchObject({
      success: true,
      blueprint: {
        schemaVersion: 2,
        id: "legacy-house",
        blocks: [{ position: { x: 0, y: 1, z: 0 }, block: "stone" }],
        blockSummary: { stone: 1, oak_slab: 0, water: 0 },
        validation: { errors: 0, warnings: ["legacy warning"] },
      },
    });
  });

  it("round-trips version-2 state and object groups without loss", () => {
    const blueprint = createBlueprint(
      [
        {
          position: { x: 0, y: 1, z: 0 },
          block: "oak_stairs",
          state: { facing: "east", half: "bottom", shape: "straight" },
          objectId: "stairs_1",
        },
        { position: { x: 1, y: 1, z: 0 }, block: "oak_fence", objectId: "fence_1" },
      ],
      { id: "porch", name: "Porch" },
    );

    expect(parseBlueprintJson(serializeBlueprintJson(blueprint))).toEqual({
      success: true,
      blueprint,
    });
  });

  it("rejects version-2 blocks with invalid state and unknown schema versions", () => {
    const blueprint = createBlueprint(
      [{ position: { x: 0, y: 1, z: 0 }, block: "stone" }],
      { id: "base", name: "Base" },
    );
    const badState = {
      ...blueprint,
      blocks: [{ position: { x: 0, y: 1, z: 0 }, block: "stone", state: { half: "top" } }],
    };
    expect(parseBlueprintJson(JSON.stringify(badState))).toMatchObject({
      success: false,
      fieldPath: "blocks[0].state",
    });

    expect(parseBlueprintJson(JSON.stringify({ ...blueprint, schemaVersion: 3 }))).toMatchObject({
      success: false,
      fieldPath: "schemaVersion",
    });
  });

  it("accepts blocks on the configured height limit", () => {
    const blueprint = createBlueprint(
      [{ position: { x: 0, y: 31, z: 0 }, block: "stone" }],
      { id: "tower", name: "Tower" },
    );

    expect(parseBlueprintJson(
      serializeBlueprintJson(blueprint),
      createArenaConfig(51, 31),
    )).toMatchObject({ success: true });
  });
});
