import type { ArenaConfig, Bounds } from "./arena-config";
import { DEFAULT_QUERY_LIMIT } from "./arena-config";
import type { BlockQuery, BlockQueryResult, BuildSlice, BuildSummary, SliceQuery } from "./arena-engine";
import type { Block, BlockCounts, BlockId } from "./block-types";
import { PHASE_A_BLOCK_IDS } from "./block-types";
import type { Coordinate } from "./coordinates";
import { validateQuery, validateSlice } from "./validation";

function sortBlocks(a: Block, b: Block): number {
  return a.position.x - b.position.x || a.position.y - b.position.y || a.position.z - b.position.z;
}

function freezeBlock(position: Coordinate, block: BlockId): Block {
  return Object.freeze({ position: Object.freeze({ ...position }), block });
}

function inBounds(position: Coordinate, bounds: Bounds): boolean {
  return position.x >= bounds.min.x && position.x <= bounds.max.x &&
    position.y >= bounds.min.y && position.y <= bounds.max.y &&
    position.z >= bounds.min.z && position.z <= bounds.max.z;
}

function allBlocks(world: QueryWorld): Block[] {
  const blocks: Block[] = [];
  for (const entry of world.entries()) blocks.push(freezeBlock(entry.position, entry.block));
  return blocks.sort(sortBlocks);
}

export type QueryWorld = Readonly<{
  get(position: Coordinate): BlockId | null;
  entries(): Iterable<{ position: Coordinate; block: BlockId }>;
}>;

export function queryBlocks(world: QueryWorld, query: BlockQuery, config: ArenaConfig, revision: number): BlockQueryResult {
  const queryFailure = validateQuery(query, config);
  if (queryFailure) throw new RangeError(`${queryFailure.fieldPath}: ${queryFailure.error}`);
  const region = query.region;
  const blocks = allBlocks(world).filter((block) =>
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

export function getSummary(world: QueryWorld, revision: number): BuildSummary {
  const blocks = allBlocks(world);
  const counts = {} as Record<BlockId, number>;
  for (const blockId of PHASE_A_BLOCK_IDS) counts[blockId] = 0;
  for (const block of blocks) counts[block.block] += 1;
  const positions = blocks.map((block) => block.position);
  const occupiedBounds = positions.length === 0 ? null : Object.freeze({
    min: Object.freeze({
      x: Math.min(...positions.map((position) => position.x)),
      y: Math.min(...positions.map((position) => position.y)),
      z: Math.min(...positions.map((position) => position.z)),
    }),
    max: Object.freeze({
      x: Math.max(...positions.map((position) => position.x)),
      y: Math.max(...positions.map((position) => position.y)),
      z: Math.max(...positions.map((position) => position.z)),
    }),
  });
  return Object.freeze({ revision, blockCount: blocks.length, counts: Object.freeze(counts) as BlockCounts, occupiedBounds });
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
    return world.get(position);
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
