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

/** Visual-only redstone kit. Stored orientation, no Arena simulation. */
export const REDSTONE_BLOCK_IDS = Object.freeze([
  "redstone_wire",
  "redstone_torch",
  "redstone_block",
  "lever",
  "button",
  "repeater",
  "comparator",
  "lamp",
  "piston",
] as const);

export const PALETTE_BLOCK_IDS = Object.freeze([
  ...PHASE_A_BLOCK_IDS,
  ...REDSTONE_BLOCK_IDS,
] as const);

export const ALL_BLOCK_IDS = Object.freeze([
  ...PHASE_A_BLOCK_IDS,
  ...PHASE_6_BLOCK_IDS,
  ...REDSTONE_BLOCK_IDS,
] as const);

export type BlockId = (typeof ALL_BLOCK_IDS)[number];

export const FACINGS = Object.freeze(["north", "east", "south", "west"] as const);
export type Facing = (typeof FACINGS)[number];
export type BlockHalf = "top" | "bottom";

/**
 * Canonical block state. Which keys are required depends on the block:
 * slab {half}, stairs {facing, half, shape}, trapdoor {facing, half, open},
 * repeater {facing}, comparator {facing, mode}.
 * Fence/wall connections derive from neighbours and are never stored.
 */
export type BlockState = Readonly<{
  facing?: Facing;
  half?: BlockHalf;
  open?: boolean;
  shape?: "straight";
  mode?: "compare" | "subtract";
}>;

export type BlockStateKind = "none" | "slab" | "stairs" | "trapdoor" | "repeater" | "comparator";

export function blockStateKind(block: BlockId): BlockStateKind {
  if (block === "oak_slab") return "slab";
  if (block === "oak_stairs") return "stairs";
  if (block === "oak_trapdoor") return "trapdoor";
  if (block === "repeater") return "repeater";
  if (block === "comparator") return "comparator";
  return "none";
}

/**
 * Occupancy at one cell: block type plus optional state and group.
 * Optional keys are omitted when absent so equality stays stable.
 */
export type WorldCell = Readonly<{
  block: BlockId;
  state?: BlockState;
  objectId?: string;
}>;

/** A positioned occupancy. The sparse world stores WorldCell; reads return Block. */
export type Block = WorldCell & Readonly<{ position: Coordinate }>;

export function freezeCell(
  block: BlockId,
  state?: BlockState,
  objectId?: string,
): WorldCell {
  const cell: { block: BlockId; state?: BlockState; objectId?: string } = { block };
  if (state) cell.state = state;
  if (objectId) cell.objectId = objectId;
  return Object.freeze(cell);
}

export function freezeOccupancy(cell: WorldCell): WorldCell {
  return freezeCell(cell.block, cell.state, cell.objectId);
}

export function cellEquals(a: WorldCell | null | undefined, b: WorldCell | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.block === b.block && blockStateEquals(a.state, b.state) && a.objectId === b.objectId;
}

export function freezeBlock(position: Coordinate, occupancy: WorldCell): Block {
  return Object.freeze({
    position: Object.freeze({ ...position }),
    ...freezeOccupancy(occupancy),
  });
}

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
      : kind === "repeater"
        ? ["facing"]
        : kind === "comparator"
          ? ["facing", "mode"]
          : ["facing", "half", "open"];
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      return { ok: false, error: `${block} state does not support "${key}"` };
    }
  }
  if (kind === "repeater") {
    if (!isFacing(value.facing)) return { ok: false, error: `${block} state requires facing: north, east, south, or west` };
    return { ok: true, state: Object.freeze({ facing: value.facing }) };
  }
  if (kind === "comparator") {
    if (!isFacing(value.facing)) return { ok: false, error: `${block} state requires facing: north, east, south, or west` };
    if (value.mode !== "compare" && value.mode !== "subtract") {
      return { ok: false, error: `${block} state requires mode: compare or subtract` };
    }
    return { ok: true, state: Object.freeze({ facing: value.facing, mode: value.mode }) };
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
  return a.facing === b.facing && a.half === b.half && a.open === b.open && a.shape === b.shape && a.mode === b.mode;
}

/** Default place state. Comparator mode is supplied here, not in normalizeBlockState. */
export function defaultStateFor(block: BlockId): BlockState | undefined {
  if (block === "repeater") return Object.freeze({ facing: "east" });
  if (block === "comparator") return Object.freeze({ facing: "east", mode: "compare" });
  return undefined;
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
