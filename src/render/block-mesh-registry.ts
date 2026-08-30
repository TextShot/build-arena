import {
  BoxGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  type BufferGeometry,
  type MeshStandardMaterialParameters,
  type Object3D,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { Block, BlockState, Facing } from "../core/block-types";
import { ALL_BLOCK_IDS, PHASE_A_BLOCK_IDS, type BlockId } from "../core/block-types";
import { BLOCK_CATALOGUE } from "../core/blocks";
import { DEFAULT_MAX_BATCH_EDITS } from "../core/arena-config";
import { coordinateKey, type Coordinate } from "../core/coordinates";

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
  water: {
    color: 0x3f76e4,
    roughness: 0.14,
    metalness: 0,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  },
  lava: { color: 0xd45a12, roughness: 0.55, metalness: 0, emissive: 0xb33f0a, emissiveIntensity: 0.9 },
  oak_slab: { color: 0xc49355, roughness: 0.82, metalness: 0 },
  oak_stairs: { color: 0xc49355, roughness: 0.82, metalness: 0 },
  oak_fence: { color: 0xb08046, roughness: 0.85, metalness: 0 },
  stone_wall: { color: 0x7d858b, roughness: 0.9, metalness: 0 },
  oak_trapdoor: { color: 0xb08046, roughness: 0.8, metalness: 0 },
};

/** Clockwise-from-north yaw for geometries authored facing north (-Z). */
const FACING_ANGLE: Record<Facing, number> = {
  north: 0,
  east: -Math.PI / 2,
  south: Math.PI,
  west: Math.PI / 2,
};

const CONNECTION_DIRECTIONS = Object.freeze([
  { facing: "north" as Facing, dx: 0, dz: -1 },
  { facing: "east" as Facing, dx: 1, dz: 0 },
  { facing: "south" as Facing, dx: 0, dz: 1 },
  { facing: "west" as Facing, dx: -1, dz: 0 },
]);

type VariantDescriptor = Readonly<{
  key: string;
  blockId: BlockId;
  state?: BlockState;
  /** Fence/wall connection flags in north/east/south/west order. */
  connections?: readonly boolean[];
}>;

function connectionBits(connections: readonly boolean[]): string {
  return connections.map((connected) => (connected ? "1" : "0")).join("");
}

function variantFor(block: Block, isConnectable: (x: number, y: number, z: number, self: BlockId) => boolean): VariantDescriptor {
  const { block: blockId, state, position } = block;
  if (blockId === "oak_slab" && state?.half) {
    return { key: `oak_slab|${state.half}`, blockId, state };
  }
  if (blockId === "oak_stairs" && state?.facing && state.half) {
    return { key: `oak_stairs|${state.facing}|${state.half}`, blockId, state };
  }
  if (blockId === "oak_trapdoor" && state?.facing && state.half) {
    return {
      key: `oak_trapdoor|${state.facing}|${state.half}|${state.open ? "open" : "closed"}`,
      blockId,
      state,
    };
  }
  if (blockId === "oak_fence" || blockId === "stone_wall") {
    const connections = CONNECTION_DIRECTIONS.map(({ dx, dz }) =>
      isConnectable(position.x + dx, position.y, position.z + dz, blockId));
    return { key: `${blockId}|${connectionBits(connections)}`, blockId, connections };
  }
  return { key: blockId, blockId };
}

function box(width: number, height: number, depth: number, x = 0, y = 0, z = 0): BufferGeometry {
  const geometry: BufferGeometry = new BoxGeometry(width, height, depth);
  geometry.translate(x, y, z);
  return geometry;
}

function merged(parts: BufferGeometry[], yaw = 0): BufferGeometry {
  const geometry = parts.length === 1 ? parts[0] : mergeGeometries(parts);
  if (parts.length > 1) for (const part of parts) part.dispose();
  if (yaw !== 0) geometry.rotateY(yaw);
  return geometry;
}

function buildVariantGeometry(variant: VariantDescriptor): BufferGeometry {
  const { blockId, state, connections } = variant;
  if (blockId === "water" || blockId === "lava") {
    return box(0.94, 0.84, 0.94, 0, -0.05, 0);
  }
  if (blockId === "oak_slab") {
    return box(0.94, 0.47, 0.94, 0, state?.half === "top" ? 0.235 : -0.235, 0);
  }
  if (blockId === "oak_stairs") {
    const top = state?.half === "top";
    const base = box(0.94, 0.47, 0.94, 0, top ? 0.235 : -0.235, 0);
    const riser = box(0.94, 0.47, 0.47, 0, top ? -0.235 : 0.235, -0.235);
    return merged([base, riser], FACING_ANGLE[state?.facing ?? "north"]);
  }
  if (blockId === "oak_trapdoor") {
    if (state?.open) {
      return merged([box(0.94, 0.94, 0.12, 0, 0, -0.41)], FACING_ANGLE[state.facing ?? "north"]);
    }
    return box(0.94, 0.12, 0.94, 0, state?.half === "top" ? 0.41 : -0.41, 0);
  }
  if (blockId === "oak_fence" || blockId === "stone_wall") {
    const wall = blockId === "stone_wall";
    const parts: BufferGeometry[] = [
      wall ? box(0.46, 0.94, 0.46) : box(0.22, 0.94, 0.22),
    ];
    for (let index = 0; index < CONNECTION_DIRECTIONS.length; index += 1) {
      if (!connections?.[index]) continue;
      const arm = wall
        ? box(0.3, 0.78, 0.24, 0, -0.08, -0.35)
        : box(0.12, 0.5, 0.36, 0, 0.08, -0.29);
      arm.rotateY(FACING_ANGLE[CONNECTION_DIRECTIONS[index].facing]);
      parts.push(arm);
    }
    return merged(parts);
  }
  return box(0.94, 0.94, 0.94);
}

export class BlockMeshRegistry {
  readonly group = new Group();

  private readonly materials = new Map<BlockId, MeshStandardMaterial>();
  private readonly meshes = new Map<string, InstancedMesh>();
  private readonly capacities = new Map<string, number>();
  private readonly coordinates = new Map<InstancedMesh, readonly Coordinate[]>();
  private readonly matrix = new Matrix4();

  constructor() {
    this.group.name = "arena-build-blocks";

    for (const blockId of ALL_BLOCK_IDS) {
      this.materials.set(blockId, new MeshStandardMaterial(BLOCK_MATERIALS[blockId]));
    }
    // Full cubes are the common case; keep them eagerly allocated. Partial-block
    // variants are created lazily because their variant space is much larger.
    for (const blockId of PHASE_A_BLOCK_IDS) {
      this.createMesh({ key: blockId, blockId }, INITIAL_MESH_CAPACITY);
    }
  }

  get raycastTargets(): readonly Object3D[] {
    return [...this.meshes.values()];
  }

  update(blocks: readonly Block[]): void {
    const occupancy = new Map<string, BlockId>();
    for (const block of blocks) occupancy.set(coordinateKey(block.position), block.block);
    const isConnectable = (x: number, y: number, z: number, self: BlockId): boolean => {
      const neighbour = occupancy.get(coordinateKey({ x, y, z }));
      if (neighbour === undefined) return false;
      return neighbour === self || BLOCK_CATALOGUE[neighbour].fullCube;
    };

    const grouped = new Map<string, { variant: VariantDescriptor; positions: Coordinate[] }>();
    for (const block of blocks) {
      const variant = variantFor(block, isConnectable);
      const entry = grouped.get(variant.key);
      if (entry) entry.positions.push(block.position);
      else grouped.set(variant.key, { variant, positions: [block.position] });
    }

    for (const [key, { variant, positions }] of grouped) {
      let mesh = this.meshes.get(key);
      const capacity = this.capacities.get(key) ?? 0;
      if (mesh && positions.length > capacity) {
        this.destroyMesh(key, mesh);
        mesh = undefined;
      }
      if (!mesh) {
        mesh = this.createMesh(variant, nextCapacity(positions.length));
      }

      const frozen = positions.map((position) => Object.freeze({ ...position }));
      for (let index = 0; index < frozen.length; index += 1) {
        const position = frozen[index];
        this.matrix.makeTranslation(position.x, position.y, position.z);
        mesh.setMatrixAt(index, this.matrix);
      }
      mesh.count = frozen.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.coordinates.set(mesh, Object.freeze(frozen));
    }

    for (const [key, mesh] of this.meshes) {
      if (grouped.has(key)) continue;
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;
      this.coordinates.set(mesh, Object.freeze([]));
    }
  }

  private createMesh(variant: VariantDescriptor, capacity: number): InstancedMesh {
    const material = this.materials.get(variant.blockId);
    if (!material) throw new Error(`Missing material for ${variant.blockId}`);
    const mesh = new InstancedMesh(buildVariantGeometry(variant), material, capacity);
    mesh.name = `blocks-${variant.key}`;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.meshes.set(variant.key, mesh);
    this.capacities.set(variant.key, capacity);
    this.coordinates.set(mesh, Object.freeze([]));
    this.group.add(mesh);
    return mesh;
  }

  private destroyMesh(key: string, mesh: InstancedMesh): void {
    this.group.remove(mesh);
    this.coordinates.delete(mesh);
    this.meshes.delete(key);
    this.capacities.delete(key);
    mesh.geometry.dispose();
    mesh.dispose();
  }

  coordinateFor(object: Object3D, instanceId: number | undefined): Coordinate | null {
    if (!(object instanceof InstancedMesh) || instanceId === undefined) return null;
    return this.coordinates.get(object)?.[instanceId] ?? null;
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    for (const material of this.materials.values()) material.dispose();
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
