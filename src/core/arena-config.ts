import type { Coordinate } from "./coordinates";

/** A finite 3D region, inclusive on both canonical coordinate endpoints. */
export type Bounds = Readonly<{
  min: Coordinate;
  max: Coordinate;
}>;

/**
 * Arena bounds with a protected horizontal foundation at platformY. Mutable Y starts at platformY + 1.
 * The MVP uses DEFAULT_ARENA_CONFIG only; resizing/configuration is deferred.
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

export const DEFAULT_ARENA_CONFIG: ArenaConfig = Object.freeze({
  minX: -3,
  maxX: 3,
  minY: 0,
  maxY: 6,
  minZ: -3,
  maxZ: 3,
  platformY: 0,
});

export const DEFAULT_MAX_BATCH_EDITS = 256;
export const DEFAULT_QUERY_LIMIT = 200;
export const MAX_QUERY_LIMIT = 500;
