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
});
