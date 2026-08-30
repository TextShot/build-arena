import type { ArenaConfig } from "./arena-config";
import { MAX_QUERY_LIMIT } from "./arena-config";
import { isBlockId } from "./block-types";
import type { BlockQuery, SliceQuery } from "./arena-engine";
import type { Coordinate } from "./coordinates";

export type ValidationFailure = Readonly<{ error: string; fieldPath: string }>;

function failure(error: string, fieldPath: string): ValidationFailure {
  return { error, fieldPath };
}

export function validateCoordinate(value: unknown, fieldPath: string): ValidationFailure | null {
  if (!isCoordinate(value)) {
    return failure("Coordinates must contain only safe integers", fieldPath);
  }
  return null;
}

export function isCoordinate(value: unknown): value is Coordinate {
  if (typeof value !== "object" || value === null) return false;
  const coordinate = value as Record<string, unknown>;
  return Number.isSafeInteger(coordinate.x) &&
    Number.isSafeInteger(coordinate.y) &&
    Number.isSafeInteger(coordinate.z);
}

export function validateArenaPosition(
  value: unknown,
  config: ArenaConfig,
  fieldPath: string,
): ValidationFailure | null {
  const coordinateFailure = validateCoordinate(value, fieldPath);
  if (coordinateFailure) return coordinateFailure;
  const coordinate = value as Coordinate;
  if (
    coordinate.x < config.minX || coordinate.x > config.maxX ||
    coordinate.y < config.minY || coordinate.y > config.maxY ||
    coordinate.z < config.minZ || coordinate.z > config.maxZ
  ) {
    return failure("Position is outside arena bounds", fieldPath);
  }
  if (coordinate.y === config.platformY) {
    return failure("The platform is protected and cannot be edited", fieldPath);
  }
  return null;
}

export function validateExpectedRevision(value: unknown, current: number): ValidationFailure | null {
  if (!Number.isSafeInteger(value)) {
    return failure("expectedRevision must be a safe integer", "expectedRevision");
  }
  if (value !== current) {
    return failure("expectedRevision is stale", "expectedRevision");
  }
  return null;
}

export function validateBounds(value: unknown, config: ArenaConfig, fieldPath: string): ValidationFailure | null {
  if (typeof value !== "object" || value === null) return failure("Bounds are required", fieldPath);
  const bounds = value as Record<string, unknown>;
  const minFailure = validateCoordinate(bounds.min, `${fieldPath}.min`);
  if (minFailure) return minFailure;
  const maxFailure = validateCoordinate(bounds.max, `${fieldPath}.max`);
  if (maxFailure) return maxFailure;
  const min = bounds.min as Coordinate;
  const max = bounds.max as Coordinate;
  if (min.x > max.x || min.y > max.y || min.z > max.z) {
    return failure("Bounds min must not exceed max", fieldPath);
  }
  if (
    min.x < config.minX || max.x > config.maxX ||
    min.y < config.minY || max.y > config.maxY ||
    min.z < config.minZ || max.z > config.maxZ
  ) {
    return failure("Bounds are outside arena bounds", fieldPath);
  }
  return null;
}

export function validateBlockType(value: unknown, fieldPath: string): ValidationFailure | null {
  return isBlockId(value) ? null : failure("Unknown Phase A block id", fieldPath);
}

export function validateQuery(value: BlockQuery, config: ArenaConfig): ValidationFailure | null {
  if (value === null || typeof value !== "object") return failure("Query must be an object", "query");
  if (value.region !== undefined) {
    const regionFailure = validateBounds(value.region, config, "region");
    if (regionFailure) return regionFailure;
  }
  if (value.layerY !== undefined) {
    if (!Number.isSafeInteger(value.layerY) || value.layerY < config.minY || value.layerY > config.maxY) {
      return failure("layerY is outside arena bounds", "layerY");
    }
  }
  if (value.blockType !== undefined) {
    const blockFailure = validateBlockType(value.blockType, "blockType");
    if (blockFailure) return blockFailure;
  }
  if (value.limit !== undefined &&
    (!Number.isSafeInteger(value.limit) || value.limit < 1 || value.limit > MAX_QUERY_LIMIT)) {
    return failure(`limit must be a safe integer from 1 to ${MAX_QUERY_LIMIT}`, "limit");
  }
  if (value.offset !== undefined &&
    (!Number.isSafeInteger(value.offset) || value.offset < 0)) {
    return failure("offset must be a non-negative safe integer", "offset");
  }
  return null;
}

export function validateSlice(value: SliceQuery, config: ArenaConfig): ValidationFailure | null {
  if (value === null || typeof value !== "object" || (value.axis !== "x" && value.axis !== "y" && value.axis !== "z")) {
    return failure("axis must be x, y, or z", "axis");
  }
  const min = value.axis === "x" ? config.minX : value.axis === "y" ? config.minY : config.minZ;
  const max = value.axis === "x" ? config.maxX : value.axis === "y" ? config.maxY : config.maxZ;
  if (!Number.isSafeInteger(value.index) || value.index < min || value.index > max) {
    return failure("slice index is outside arena bounds", "index");
  }
  return null;
}
