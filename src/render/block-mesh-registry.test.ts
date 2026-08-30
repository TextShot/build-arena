import { describe, expect, it } from "vitest";

import type { Block } from "../core/block-types";
import { BlockMeshRegistry } from "./block-mesh-registry";

describe("BlockMeshRegistry", () => {
  it("groups block snapshots into reusable instances and keeps coordinate lookup exact", () => {
    const registry = new BlockMeshRegistry();
    const blocks: readonly Block[] = [
      { position: { x: -1, y: 1, z: 0 }, block: "stone" },
      { position: { x: 2, y: 3, z: -2 }, block: "stone" },
      { position: { x: 0, y: 1, z: 0 }, block: "glass" },
    ];

    registry.update(blocks);

    const stone = registry.raycastTargets.find((object) => object.name === "blocks-stone");
    const glass = registry.raycastTargets.find((object) => object.name === "blocks-glass");
    expect(registry.raycastTargets).toHaveLength(7);
    expect(stone && "count" in stone ? stone.count : null).toBe(2);
    expect(glass && "count" in glass ? glass.count : null).toBe(1);
    expect(stone ? registry.coordinateFor(stone, 1) : null).toEqual({ x: 2, y: 3, z: -2 });

    registry.update([]);
    expect(stone && "count" in stone ? stone.count : null).toBe(0);
    registry.dispose();
  });
});
