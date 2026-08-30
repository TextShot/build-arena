import type { ArenaConfig, Bounds } from "./arena-config";
import { DEFAULT_QUERY_LIMIT } from "./arena-config";
import type {
  BlockChange,
  BlockQuery,
  BlockQueryResult,
  BuildSlice,
  BuildSummary,
  ObjectGroup,
  SliceQuery,
  WorldCell,
} from "./arena-engine";
import { freezeBlock, type Block, type BlockCounts, type BlockId } from "./block-types";
import { ALL_BLOCK_IDS } from "./block-types";
import type { Coordinate } from "./coordinates";
import { validateQuery, validateSlice } from "./validation";

function sortBlocks(a: Block, b: Block): number {
  return a.position.x - b.position.x || a.position.y - b.position.y || a.position.z - b.position.z;
}

function inBounds(position: Coordinate, bounds: Bounds): boolean {
  return position.x >= bounds.min.x && position.x <= bounds.max.x &&
    position.y >= bounds.min.y && position.y <= bounds.max.y &&
    position.z >= bounds.min.z && position.z <= bounds.max.z;
}

export function snapshotBlocks(world: QueryWorld): readonly Block[] {
  const blocks: Block[] = [];
  for (const entry of world.entries()) blocks.push(freezeBlock(entry.position, entry.cell));
  return Object.freeze(blocks.sort(sortBlocks));
}

export type QueryWorld = Readonly<{
  get(position: Coordinate): WorldCell | null;
  entries(): Iterable<{ position: Coordinate; cell: WorldCell }>;
}>;

export type ObjectGroupRecord = { block: BlockId; count: number };

/** Applies occupancy deltas to the persistent object-group index. */
export function applyObjectGroupChanges(
  index: Map<string, ObjectGroupRecord>,
  changes: readonly BlockChange[],
): void {
  for (const change of changes) {
    const beforeId = change.before?.objectId;
    if (beforeId) {
      const entry = index.get(beforeId);
      if (entry) {
        if (entry.count <= 1) index.delete(beforeId);
        else entry.count -= 1;
      }
    }
    const after = change.after;
    if (after?.objectId) {
      const entry = index.get(after.objectId);
      if (entry) {
        entry.count += 1;
        entry.block = after.block;
      } else {
        index.set(after.objectId, { block: after.block, count: 1 });
      }
    }
  }
}

export function snapshotObjectGroups(index: ReadonlyMap<string, ObjectGroupRecord>): readonly ObjectGroup[] {
  return Object.freeze(
    [...index.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([objectId, group]) => Object.freeze({ objectId, block: group.block, count: group.count })),
  );
}

export function queryBlocks(world: QueryWorld, query: BlockQuery, config: ArenaConfig, revision: number): BlockQueryResult {
  const queryFailure = validateQuery(query, config);
  if (queryFailure) throw new RangeError(`${queryFailure.fieldPath}: ${queryFailure.error}`);
  const region = query.region;
  const blocks = snapshotBlocks(world).filter((block) =>
    (!region || inBounds(block.position, region)) &&
    (query.layerY === undefined || block.position.y === query.layerY) &&
    (query.blockType === undefined || block.block === query.blockType),
  );
  const offset = query.offset ?? 0;
  const limit = query.limit ?? DEFAULT_QUERY_LIMIT;
  return Object.freeze({
    revision,
    blocks: Object.freeze(blocks.slice(offset, offset + limit)),
    truncated: offset + limit < blocks.length,
  });
}

export function getSummary(
  world: QueryWorld,
  revision: number,
  objectGroups: readonly ObjectGroup[],
): BuildSummary {
  const blocks = snapshotBlocks(world);
  const counts = {} as Record<BlockId, number>;
  for (const blockId of ALL_BLOCK_IDS) counts[blockId] = 0;
  if (blocks.length === 0) {
    return Object.freeze({
      revision,
      blockCount: 0,
      counts: Object.freeze(counts) as BlockCounts,
      occupiedBounds: null,
      objectGroups,
    });
  }

  const min = { ...blocks[0].position };
  const max = { ...blocks[0].position };
  for (const block of blocks) {
    counts[block.block] += 1;
    min.x = Math.min(min.x, block.position.x);
    min.y = Math.min(min.y, block.position.y);
    min.z = Math.min(min.z, block.position.z);
    max.x = Math.max(max.x, block.position.x);
    max.y = Math.max(max.y, block.position.y);
    max.z = Math.max(max.z, block.position.z);
  }
  const occupiedBounds = Object.freeze({
    min: Object.freeze(min),
    max: Object.freeze(max),
  });
  return Object.freeze({
    revision,
    blockCount: blocks.length,
    counts: Object.freeze(counts) as BlockCounts,
    occupiedBounds,
    objectGroups,
  });
}

export function getSlice(world: QueryWorld, query: SliceQuery, config: ArenaConfig, revision: number): BuildSlice {
  const sliceFailure = validateSlice(query, config);
  if (sliceFailure) throw new RangeError(`${sliceFailure.fieldPath}: ${sliceFailure.error}`);
  let rowAxis: "x" | "y" | "z";
  let columnAxis: "x" | "y" | "z";
  let rowCoordinates: readonly number[];
  let columnCoordinates: readonly number[];
  if (query.axis === "y") {
    rowAxis = "z"; columnAxis = "x";
    rowCoordinates = range(config.minZ, config.maxZ);
    columnCoordinates = range(config.minX, config.maxX);
  } else if (query.axis === "x") {
    rowAxis = "y"; columnAxis = "z";
    rowCoordinates = range(config.minY, config.maxY);
    columnCoordinates = range(config.minZ, config.maxZ);
  } else {
    rowAxis = "y"; columnAxis = "x";
    rowCoordinates = range(config.minY, config.maxY);
    columnCoordinates = range(config.minX, config.maxX);
  }
  const cells = rowCoordinates.map((row) => columnCoordinates.map((column) => {
    const position = query.axis === "y"
      ? { x: column, y: query.index, z: row }
      : query.axis === "x"
        ? { x: query.index, y: row, z: column }
        : { x: column, y: row, z: query.index };
    if (position.y === config.platformY) return null;
    return world.get(position)?.block ?? null;
  }));
  return Object.freeze({
    axis: query.axis,
    index: query.index,
    revision,
    rowAxis,
    columnAxis,
    rowCoordinates: Object.freeze([...rowCoordinates]),
    columnCoordinates: Object.freeze([...columnCoordinates]),
    cells: Object.freeze(cells.map((row) => Object.freeze(row))),
  });
}

function range(min: number, max: number): readonly number[] {
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}
