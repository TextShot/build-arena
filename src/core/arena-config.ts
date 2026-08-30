import type { Coordinate } from "./coordinates";

/** A finite 3D region, inclusive on both canonical coordinate endpoints. */
export type Bounds = Readonly<{
  min: Coordinate;
  max: Coordinate;
}>;

/**
 * Arena bounds with a protected horizontal foundation at platformY. Mutable Y starts at platformY + 1.
 * The default is 7×7; runtime resizing keeps X/Z centred on zero.
 */
export type ArenaConfig = Readonly<{
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  platformY: 0;
}>;

export const MIN_PLATFORM_SIZE = 3;
export const MAX_PLATFORM_SIZE = 101;

export function createArenaConfig(platformSize: number): ArenaConfig {
  if (
    !Number.isSafeInteger(platformSize) ||
    platformSize < MIN_PLATFORM_SIZE ||
    platformSize > MAX_PLATFORM_SIZE ||
    platformSize % 2 === 0
  ) {
    throw new RangeError(`platformSize must be an odd integer from ${MIN_PLATFORM_SIZE} to ${MAX_PLATFORM_SIZE}`);
  }
  const radius = (platformSize - 1) / 2;
  return Object.freeze({
    minX: -radius,
    maxX: radius,
    minY: 0,
    maxY: 6,
    minZ: -radius,
    maxZ: radius,
    platformY: 0,
  });
}

export function platformSizeForConfig(config: ArenaConfig): number {
  return config.maxX - config.minX + 1;
}

export const DEFAULT_ARENA_CONFIG: ArenaConfig = createArenaConfig(7);

export const DEFAULT_MAX_BATCH_EDITS = 256;
export const DEFAULT_QUERY_LIMIT = 200;
export const MAX_QUERY_LIMIT = 500;
