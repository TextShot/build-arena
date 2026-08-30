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
import { DEFAULT_MAX_BATCH_EDITS } from "../core/arena-config";
import type { Coordinate } from "../core/coordinates";

const INITIAL_MESH_CAPACITY = DEFAULT_MAX_BATCH_EDITS;

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
  private readonly materials = new Map<BlockId, MeshStandardMaterial>();
  private readonly meshes = new Map<BlockId, InstancedMesh>();
  private readonly capacities = new Map<BlockId, number>();
  private readonly coordinates = new Map<InstancedMesh, readonly Coordinate[]>();
  private readonly matrix = new Matrix4();

  constructor() {
    this.group.name = "arena-build-blocks";

    for (const blockId of PHASE_A_BLOCK_IDS) {
      const material = new MeshStandardMaterial(BLOCK_MATERIALS[blockId]);
      this.materials.set(blockId, material);
      this.createMesh(blockId, INITIAL_MESH_CAPACITY);
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
      let mesh = this.meshes.get(blockId);
      const matchingBlocks = grouped.get(blockId);
      if (!mesh || !matchingBlocks) continue;

      const capacity = this.capacities.get(blockId) ?? 0;
      if (matchingBlocks.length > capacity) {
        this.group.remove(mesh);
        this.coordinates.delete(mesh);
        mesh.dispose();
        mesh = this.createMesh(blockId, nextCapacity(matchingBlocks.length));
      }

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

  private createMesh(blockId: BlockId, capacity: number): InstancedMesh {
    const material = this.materials.get(blockId);
    if (!material) throw new Error(`Missing material for ${blockId}`);
    const mesh = new InstancedMesh(this.geometry, material, capacity);
    mesh.name = `blocks-${blockId}`;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.meshes.set(blockId, mesh);
    this.capacities.set(blockId, capacity);
    this.coordinates.set(mesh, Object.freeze([]));
    this.group.add(mesh);
    return mesh;
  }

  coordinateFor(object: Object3D, instanceId: number | undefined): Coordinate | null {
    if (!(object instanceof InstancedMesh) || instanceId === undefined) return null;
    return this.coordinates.get(object)?.[instanceId] ?? null;
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) mesh.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.geometry.dispose();
    this.materials.clear();
    this.meshes.clear();
    this.capacities.clear();
    this.coordinates.clear();
    this.group.clear();
  }
}

function nextCapacity(required: number): number {
  let capacity = INITIAL_MESH_CAPACITY;
  while (capacity < required) capacity *= 2;
  return capacity;
}
