import type { BlockEdit } from "./arena-engine";
import { PHASE_A_BLOCK_IDS, type Block, type BlockCounts, type BlockId } from "./block-types";
import { coordinateKey, type CoordinateKey } from "./coordinates";

export type BlueprintV1 = Readonly<{
  schemaVersion: 1;
  id: string;
  name: string;
  size: Readonly<{ x: number; y: number; z: number }>;
  anchor: Readonly<{ x: 0; y: 0; z: 0 }>;
  blocks: readonly Block[];
  blockSummary: BlockCounts;
  validation: Readonly<{ errors: 0; warnings: readonly string[] }>;
  preview: Readonly<{ view: "isometric" }>;
}>;

export type BlueprintIdentity = Readonly<{ id: string; name: string }>;

function compareBlocks(left: Block, right: Block): number {
  return left.position.x - right.position.x ||
    left.position.y - right.position.y ||
    left.position.z - right.position.z;
}

function emptyBlockCounts(): Record<BlockId, number> {
  return Object.fromEntries(PHASE_A_BLOCK_IDS.map((blockId) => [blockId, 0])) as Record<BlockId, number>;
}

function copyBlocks(blocks: readonly Block[]): readonly Block[] {
  const seen = new Set<string>();
  const copies = blocks.map((block) => {
    const key = coordinateKey(block.position);
    if (seen.has(key)) throw new Error(`Duplicate blueprint coordinate: ${key}`);
    seen.add(key);
    return Object.freeze({ position: Object.freeze({ ...block.position }), block: block.block });
  });
  return Object.freeze(copies.sort(compareBlocks));
}

export function createBlueprint(
  blocks: readonly Block[],
  identity: BlueprintIdentity,
): BlueprintV1 {
  const sortedBlocks = copyBlocks(blocks);
  const blockSummary = emptyBlockCounts();
  for (const block of sortedBlocks) blockSummary[block.block] += 1;

  const size = getBlueprintSize(sortedBlocks);

  return Object.freeze({
    schemaVersion: 1,
    id: identity.id,
    name: identity.name,
    size: Object.freeze(size),
    anchor: Object.freeze({ x: 0, y: 0, z: 0 }),
    blocks: sortedBlocks,
    blockSummary: Object.freeze(blockSummary),
    validation: Object.freeze({ errors: 0, warnings: Object.freeze([]) }),
    preview: Object.freeze({ view: "isometric" }),
  });
}

function getBlueprintSize(blocks: readonly Block[]): { x: number; y: number; z: number } {
  if (blocks.length === 0) return { x: 0, y: 0, z: 0 };
  let minX = blocks[0].position.x;
  let maxX = minX;
  let minY = blocks[0].position.y;
  let maxY = minY;
  let minZ = blocks[0].position.z;
  let maxZ = minZ;
  for (const { position } of blocks.slice(1)) {
    minX = Math.min(minX, position.x);
    maxX = Math.max(maxX, position.x);
    minY = Math.min(minY, position.y);
    maxY = Math.max(maxY, position.y);
    minZ = Math.min(minZ, position.z);
    maxZ = Math.max(maxZ, position.z);
  }
  return { x: maxX - minX + 1, y: maxY - minY + 1, z: maxZ - minZ + 1 };
}

export function diffBlueprintBlocks(
  currentBlocks: readonly Block[],
  nextBlocks: readonly Block[],
): BlockEdit[] {
  const current = new Map(currentBlocks.map((block) => [coordinateKey(block.position), block]));
  const next = new Map<CoordinateKey, Block>();
  for (const block of nextBlocks) {
    const key = coordinateKey(block.position);
    if (next.has(key)) throw new Error(`Duplicate blueprint coordinate: ${key}`);
    next.set(key, block);
  }

  const edits: BlockEdit[] = [];
  for (const [key, block] of next) {
    const existing = current.get(key);
    if (!existing) edits.push({ action: "place", position: block.position, block: block.block });
    else if (existing.block !== block.block) {
      edits.push({ action: "replace", position: block.position, block: block.block });
    }
  }
  for (const [key, block] of current) {
    if (!next.has(key)) edits.push({ action: "remove", position: block.position });
  }

  return edits.sort((left, right) =>
    left.position.x - right.position.x ||
    left.position.y - right.position.y ||
    left.position.z - right.position.z,
  );
}
