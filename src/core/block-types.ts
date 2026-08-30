import type { Coordinate } from "./coordinates";

export const PHASE_A_BLOCK_IDS = Object.freeze([
  "dirt",
  "stone",
  "oak_log",
  "oak_planks",
  "leaves",
  "glass",
  "obsidian",
] as const);

export type BlockId = (typeof PHASE_A_BLOCK_IDS)[number];

/** A full cube in the sparse arena world. Phase A has no block state. */
export type Block = Readonly<{
  position: Coordinate;
  block: BlockId;
}>;

export type BlockCounts = Readonly<Record<BlockId, number>>;

export function isBlockId(value: unknown): value is BlockId {
  return typeof value === "string" && PHASE_A_BLOCK_IDS.some((blockId) => blockId === value);
}
