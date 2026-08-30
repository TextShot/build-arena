import { describe, expect, it } from "vitest";
import type { InstancedMesh } from "three";

import type { Block } from "../core/block-types";
import { BlockMeshRegistry } from "./block-mesh-registry";

describe("block mesh registry", () => {
  it("grows instance capacity instead of preallocating the maximum arena volume", () => {
    const registry = new BlockMeshRegistry();
    const initialCapacity = registry.raycastTargets.reduce(
      (total, target) => total + (target as InstancedMesh).instanceMatrix.count,
      0,
    );
    const blocks: Block[] = Array.from({ length: 300 }, (_, index) => ({
      position: { x: index, y: 1, z: 0 },
      block: "stone",
    }));

    registry.update(blocks);

    const stone = registry.raycastTargets.find((target) => target.name === "blocks-stone") as InstancedMesh;
    expect(initialCapacity).toBe(1_792);
    expect(stone.count).toBe(300);
    expect(stone.instanceMatrix.count).toBe(512);
    registry.dispose();
  });
});
