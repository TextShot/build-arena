import { describe, expect, it } from "vitest";

import type { Block } from "./block-types";
import { createBlueprint, diffBlueprintBlocks } from "./blueprint";

describe("blueprint core", () => {
  it("creates deterministic versioned metadata from local arena blocks", () => {
    const blocks: readonly Block[] = [
      { position: { x: 1, y: 2, z: 2 }, block: "glass" },
      { position: { x: -1, y: 1, z: 0 }, block: "stone" },
    ];

    expect(createBlueprint(blocks, { id: "arena-build", name: "Arena Build" })).toMatchObject({
      schemaVersion: 2,
      id: "arena-build",
      name: "Arena Build",
      size: { x: 3, y: 2, z: 3 },
      anchor: { x: 0, y: 0, z: 0 },
      blocks: [
        { position: { x: -1, y: 1, z: 0 }, block: "stone" },
        { position: { x: 1, y: 2, z: 2 }, block: "glass" },
      ],
      blockSummary: { stone: 1, glass: 1 },
      validation: { errors: 0, warnings: [] },
      preview: { view: "isometric" },
    });
  });

  it("diffs a complete blueprint snapshot into one deterministic atomic edit list", () => {
    const current: readonly Block[] = [
      { position: { x: 0, y: 1, z: 0 }, block: "stone" },
      { position: { x: 1, y: 1, z: 0 }, block: "glass" },
    ];
    const next: readonly Block[] = [
      { position: { x: 0, y: 1, z: 0 }, block: "dirt" },
      { position: { x: 2, y: 1, z: 0 }, block: "glass" },
    ];

    expect(diffBlueprintBlocks(current, next)).toEqual([
      { action: "replace", position: { x: 0, y: 1, z: 0 }, block: "dirt" },
      { action: "remove", position: { x: 1, y: 1, z: 0 } },
      { action: "place", position: { x: 2, y: 1, z: 0 }, block: "glass" },
    ]);
  });
});
