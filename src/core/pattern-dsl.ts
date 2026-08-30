import type { ArenaConfig, Bounds } from "./arena-config";
import type { GenerateShapeCommand } from "./arena-engine";
import { blockStateKind, isBlockId, type BlockId } from "./block-types";
import { validateBounds } from "./validation";

/**
 * Compact run-string grammar:
 *   `block_objectId@x,y,z+(axisCount)` or `block_objectId@x,y,z-(axisCount)`
 * Example: `oak_planks_1@0,1,0-(x5)` places five oak planks (count includes the
 * origin) toward negative X, grouped under objectId "oak_planks_1".
 *
 * The parser only produces a generate_shape command; it never mutates the world.
 */
export type PatternDslSuccess = Readonly<{
  success: true;
  /** Ready for engine.apply once the caller adds expectedRevision. */
  command: Omit<GenerateShapeCommand, "expectedRevision">;
}>;

export type PatternDslFailure = Readonly<{
  success: false;
  error: string;
  fieldPath: string;
}>;

export type PatternDslResult = PatternDslSuccess | PatternDslFailure;

const PATTERN = /^([a-z][a-z_]*)_(\d+)@(-?\d+),(-?\d+),(-?\d+)([+-])\((x|y|z)(\d+)\)$/;

function fail(error: string, fieldPath: string): PatternDslFailure {
  return { success: false, error, fieldPath };
}

export function parsePatternDsl(text: string, config: ArenaConfig): PatternDslResult {
  if (typeof text !== "string" || text.trim() === "") {
    return fail("Pattern is required", "pattern");
  }
  const match = PATTERN.exec(text.trim());
  if (!match) {
    return fail(
      "Pattern must look like block_objectId@x,y,z+(axisCount), for example oak_planks_1@0,1,0-(x5)",
      "pattern",
    );
  }
  const [, blockToken, groupNumber, xText, yText, zText, sign, axis, countText] = match;
  if (!isBlockId(blockToken)) {
    return fail(`Unknown block id "${blockToken}"`, "pattern.block");
  }
  const block: BlockId = blockToken;
  if (blockStateKind(block) !== "none") {
    return fail(`${block} requires block state; use generate_shape with a state object instead`, "pattern.block");
  }
  const origin = { x: Number(xText), y: Number(yText), z: Number(zText) };
  if (![origin.x, origin.y, origin.z].every(Number.isSafeInteger)) {
    return fail("Origin coordinates must be safe integers", "pattern.origin");
  }
  const count = Number(countText);
  if (!Number.isSafeInteger(count) || count < 1) {
    return fail("Count must be a positive integer and includes the origin block", "pattern.count");
  }

  const step = sign === "+" ? 1 : -1;
  const end = {
    x: origin.x + (axis === "x" ? step * (count - 1) : 0),
    y: origin.y + (axis === "y" ? step * (count - 1) : 0),
    z: origin.z + (axis === "z" ? step * (count - 1) : 0),
  };
  const region: Bounds = Object.freeze({
    min: Object.freeze({
      x: Math.min(origin.x, end.x),
      y: Math.min(origin.y, end.y),
      z: Math.min(origin.z, end.z),
    }),
    max: Object.freeze({
      x: Math.max(origin.x, end.x),
      y: Math.max(origin.y, end.y),
      z: Math.max(origin.z, end.z),
    }),
  });
  const boundsFailure = validateBounds(region, config, "pattern.origin");
  if (boundsFailure) {
    return fail("The run leaves the arena bounds; shrink the count or move the origin", "pattern.count");
  }
  if (region.min.y <= config.platformY) {
    return fail("The run must stay above the protected platform (y >= 1)", "pattern.origin");
  }

  return {
    success: true,
    command: Object.freeze({
      type: "generate_shape" as const,
      shape: "filled_box" as const,
      region,
      block,
      objectId: `${blockToken}_${groupNumber}`,
    }),
  };
}
