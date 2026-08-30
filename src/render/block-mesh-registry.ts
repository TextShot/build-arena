import {
  BoxGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  type Object3D,
} from "three";

import type { Block } from "../core/block-types";
import { PHASE_A_BLOCK_IDS, type BlockId } from "../core/block-types";
import type { Coordinate } from "../core/coordinates";

const MAX_BUILD_BLOCKS = 7 * 7 * 6;

const BLOCK_MATERIALS: Record<BlockId, MeshStandardMaterialParameters> = {
  dirt: { color: 0x8b5a35, roughness: 0.96, metalness: 0 },
  stone: { color: 0x8a9298, roughness: 0.88, metalness: 0 },
  oak_log: { color: 0x7a4e2d, roughness: 0.9, metalness: 0 },
  oak_planks: { color: 0xc49355, roughness: 0.82, metalness: 0 },
  leaves: { color: 0x4f8a51, roughness: 0.9, metalness: 0 },
  glass: {
    color: 0x9adbe8,
    roughness: 0.2,
    metalness: 0,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  },
  obsidian: { color: 0x28243b, roughness: 0.48, metalness: 0.12 },
};

export class BlockMeshRegistry {
  readonly group = new Group();

  private readonly geometry = new BoxGeometry(0.94, 0.94, 0.94);
  private readonly meshes = new Map<BlockId, InstancedMesh>();
  private readonly coordinates = new Map<InstancedMesh, readonly Coordinate[]>();
  private readonly matrix = new Matrix4();

  constructor() {
    this.group.name = "arena-build-blocks";

    for (const blockId of PHASE_A_BLOCK_IDS) {
      const material = new MeshStandardMaterial(BLOCK_MATERIALS[blockId]);
      const mesh = new InstancedMesh(this.geometry, material, MAX_BUILD_BLOCKS);
      mesh.name = `blocks-${blockId}`;
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      this.meshes.set(blockId, mesh);
      this.coordinates.set(mesh, Object.freeze([]));
      this.group.add(mesh);
    }
  }

  get raycastTargets(): readonly Object3D[] {
    return [...this.meshes.values()];
  }

  update(blocks: readonly Block[]): void {
    const grouped = new Map<BlockId, Block[]>();
    for (const blockId of PHASE_A_BLOCK_IDS) grouped.set(blockId, []);
    for (const block of blocks) grouped.get(block.block)?.push(block);

    for (const blockId of PHASE_A_BLOCK_IDS) {
      const mesh = this.meshes.get(blockId);
      const matchingBlocks = grouped.get(blockId);
      if (!mesh || !matchingBlocks) continue;

      const positions = matchingBlocks.map(({ position }) => Object.freeze({ ...position }));
      for (let index = 0; index < positions.length; index += 1) {
        const position = positions[index];
        this.matrix.makeTranslation(position.x, position.y, position.z);
        mesh.setMatrixAt(index, this.matrix);
      }
      mesh.count = positions.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.coordinates.set(mesh, Object.freeze(positions));
    }
  }

  coordinateFor(object: Object3D, instanceId: number | undefined): Coordinate | null {
    if (!(object instanceof InstancedMesh) || instanceId === undefined) return null;
    return this.coordinates.get(object)?.[instanceId] ?? null;
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) material.dispose();
    }
    this.geometry.dispose();
    this.meshes.clear();
    this.coordinates.clear();
    this.group.clear();
  }
}
