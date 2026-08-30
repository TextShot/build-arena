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

/** Phase 6 partial and visual blocks. Water/lava are static visuals with no state. */
export const PHASE_6_BLOCK_IDS = Object.freeze([
  "water",
  "lava",
  "oak_slab",
  "oak_stairs",
  "oak_fence",
  "stone_wall",
  "oak_trapdoor",
] as const);

export const ALL_BLOCK_IDS = Object.freeze([
  ...PHASE_A_BLOCK_IDS,
  ...PHASE_6_BLOCK_IDS,
] as const);

export type BlockId = (typeof ALL_BLOCK_IDS)[number];

export const FACINGS = Object.freeze(["north", "east", "south", "west"] as const);
export type Facing = (typeof FACINGS)[number];
export type BlockHalf = "top" | "bottom";

/**
 * Canonical block state. Which keys are required depends on the block:
 * slab {half}, stairs {facing, half, shape}, trapdoor {facing, half, open}.
 * Fence/wall connections derive from neighbours and are never stored.
 */
export type BlockState = Readonly<{
  facing?: Facing;
  half?: BlockHalf;
  open?: boolean;
  shape?: "straight";
}>;

export type BlockStateKind = "none" | "slab" | "stairs" | "trapdoor";

export function blockStateKind(block: BlockId): BlockStateKind {
  if (block === "oak_slab") return "slab";
  if (block === "oak_stairs") return "stairs";
  if (block === "oak_trapdoor") return "trapdoor";
  return "none";
}

/** A block in the sparse arena world. State/objectId keys are omitted when absent. */
export type Block = Readonly<{
  position: Coordinate;
  block: BlockId;
  state?: BlockState;
  objectId?: string;
}>;

export type BlockCounts = Readonly<Record<BlockId, number>>;

export function isBlockId(value: unknown): value is BlockId {
  return typeof value === "string" && ALL_BLOCK_IDS.some((blockId) => blockId === value);
}

export function isFacing(value: unknown): value is Facing {
  return typeof value === "string" && FACINGS.some((facing) => facing === value);
}

export function isBlockHalf(value: unknown): value is BlockHalf {
  return value === "top" || value === "bottom";
}

export type NormalizedState =
  | Readonly<{ ok: true; state?: BlockState }>
  | Readonly<{ ok: false; error: string }>;

/**
 * Validates and canonicalizes block state for one block id.
 * Returns a frozen state with a stable key order so serialization is deterministic.
 */
export function normalizeBlockState(block: BlockId, state: unknown): NormalizedState {
  const kind = blockStateKind(block);
  if (kind === "none") {
    if (state === undefined) return { ok: true };
    return { ok: false, error: `${block} does not support block state` };
  }
  if (state === null || typeof state !== "object") {
    return { ok: false, error: `${block} requires block state` };
  }
  const value = state as Record<string, unknown>;
  const allowedKeys = kind === "slab"
    ? ["half"]
    : kind === "stairs"
      ? ["facing", "half", "shape"]
      : ["facing", "half", "open"];
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      return { ok: false, error: `${block} state does not support "${key}"` };
    }
  }
  if (!isBlockHalf(value.half)) return { ok: false, error: `${block} state requires half: top or bottom` };
  if (kind === "slab") {
    return { ok: true, state: Object.freeze({ half: value.half }) };
  }
  if (!isFacing(value.facing)) return { ok: false, error: `${block} state requires facing: north, east, south, or west` };
  if (kind === "stairs") {
    if (value.shape !== undefined && value.shape !== "straight") {
      return { ok: false, error: `${block} shape must be "straight"` };
    }
    return { ok: true, state: Object.freeze({ facing: value.facing, half: value.half, shape: "straight" as const }) };
  }
  if (typeof value.open !== "boolean") return { ok: false, error: `${block} state requires open: true or false` };
  return { ok: true, state: Object.freeze({ facing: value.facing, half: value.half, open: value.open }) };
}

export function blockStateEquals(a: BlockState | undefined, b: BlockState | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.facing === b.facing && a.half === b.half && a.open === b.open && a.shape === b.shape;
}

/** Rotates a facing clockwise (viewed from above) by quarter turns. */
export function rotateFacing(facing: Facing, quarterTurns: number): Facing {
  const index = FACINGS.indexOf(facing);
  return FACINGS[(index + ((quarterTurns % 4) + 4)) % 4];
}

/** Mirrors a facing across an axis: x flips east/west, z flips north/south. */
export function mirrorFacing(facing: Facing, axis: "x" | "z"): Facing {
  if (axis === "x") {
    if (facing === "east") return "west";
    if (facing === "west") return "east";
    return facing;
  }
  if (facing === "north") return "south";
  if (facing === "south") return "north";
  return facing;
}

const OBJECT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID_PATTERN.test(value);
}
