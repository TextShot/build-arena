import type { ArenaConfig, Bounds } from "./arena-config";
import {
  DEFAULT_ARENA_CONFIG,
  DEFAULT_MAX_BATCH_EDITS,
  DEFAULT_QUERY_LIMIT,
  MAX_QUERY_LIMIT,
} from "./arena-config";
import type { Block, BlockCounts, BlockId, BlockState } from "./block-types";
import { ALL_BLOCK_IDS } from "./block-types";
import type { Coordinate } from "./coordinates";

export { DEFAULT_ARENA_CONFIG } from "./arena-config";
export { ALL_BLOCK_IDS, PHASE_A_BLOCK_IDS } from "./block-types";
export type { ArenaConfig, Bounds } from "./arena-config";
export type { Block, BlockCounts, BlockId, BlockState } from "./block-types";
export type { Coordinate, CoordinateKey } from "./coordinates";

/** The value stored at one occupied world cell. Optional keys are omitted when absent. */
export type WorldCell = Readonly<{
  block: BlockId;
  state?: BlockState;
  objectId?: string;
}>;

export type BlockEdit =
  /** Place is valid only when the target is empty. */
  | Readonly<{
      action: "place";
      position: Coordinate;
      block: BlockId;
      state?: BlockState;
      objectId?: string;
    }>
  /** Replace is valid only when occupied; an identical cell is a no-op. */
  | Readonly<{
      action: "replace";
      position: Coordinate;
      block: BlockId;
      state?: BlockState;
      objectId?: string;
    }>
  /** Removing an empty target is a valid no-op. */
  | Readonly<{
      action: "remove";
      position: Coordinate;
    }>;

export type SetBlocksCommand = Readonly<{
  type: "set_blocks";
  expectedRevision: number;
  /** The engine rejects duplicate coordinates before applying any edit. */
  edits: readonly BlockEdit[];
}>;

export type UndoCommand = Readonly<{
  type: "undo";
  expectedRevision: number;
  /** Older targeted entries are rejected to preserve linear history. */
  undoId?: string;
}>;

export type RedoCommand = Readonly<{
  type: "redo";
  expectedRevision: number;
}>;

export type ShapeKind = "floor" | "wall" | "filled_box" | "hollow_box";

/**
 * Fills a shape inside `region` with one block (place-or-replace per cell).
 * Cells already holding an identical cell value are skipped. Atomic and revisioned.
 */
export type GenerateShapeCommand = Readonly<{
  type: "generate_shape";
  expectedRevision: number;
  shape: ShapeKind;
  region: Bounds;
  block: BlockId;
  state?: BlockState;
  objectId?: string;
  /** Validate and report affected cells without mutating the world. */
  dryRun?: boolean;
}>;

export type TransformOperation = "copy" | "move" | "rotate" | "mirror" | "replace_type";

export type TransformRegionCommand = Readonly<{
  type: "transform_region";
  expectedRevision: number;
  operation: TransformOperation;
  region: Bounds;
  /** copy/move target offset. */
  offset?: Coordinate;
  /** rotate: clockwise degrees around Y within the region, anchored at region min. */
  rotation?: 90 | 180 | 270;
  /** mirror axis: x flips east/west, z flips north/south. */
  axis?: "x" | "z";
  /** replace_type source and target block ids. */
  from?: BlockId;
  to?: BlockId;
  dryRun?: boolean;
}>;

/** Core cancellation is deferred; adapters may add it later. */
export type ArenaCommand =
  | SetBlocksCommand
  | UndoCommand
  | RedoCommand
  | GenerateShapeCommand
  | TransformRegionCommand;

export type ArenaSuccess = Readonly<{
  success: true;
  revision: number;
  affectedBlocks: number;
  /** Null for a valid no-op, which does not create history or an event. */
  affectedBounds: Bounds | null;
  warnings: readonly string[];
  /** Null for a valid no-op, which has no history entry to undo. */
  undoId: string | null;
  /** Present when the command created or extended a persistent object group. */
  objectId?: string;
}>;

export type ArenaFailure = Readonly<{
  success: false;
  /** The revision that was current when validation failed. */
  revision: number;
  error: string;
  fieldPath?: string;
}>;

export type ArenaResult = ArenaSuccess | ArenaFailure;
export type ArenaCommandResult = ArenaResult;

export type BlockQuery = Readonly<{
  /** Results include mutable build blocks only; the implicit platform is excluded. */
  region?: Bounds;
  layerY?: number;
  blockType?: BlockId;
  /** Valid range is 1..500; default is 200. */
  limit?: number;
  /** Non-negative page offset. Callers restart at zero after revision changes. */
  offset?: number;
}>;

export type BlockQueryResult = Readonly<{
  revision: number;
  /** Results are lexicographic by ascending x, then y, then z. */
  blocks: readonly Block[];
  truncated: boolean;
}>;

/** Fix one coordinate axis and return the other two as an exact 2D slice. */
export type SliceQuery = Readonly<{
  axis: "x" | "y" | "z";
  index: number;
}>;

export type BuildSlice = Readonly<{
  axis: SliceQuery["axis"];
  index: number;
  revision: number;
  rowAxis: "x" | "y" | "z";
  columnAxis: "x" | "y" | "z";
  rowCoordinates: readonly number[];
  columnCoordinates: readonly number[];
  /**
   * Matrix is [row][column]. Axis mapping is y: rows=z/columns=x,
   * x: rows=y/columns=z, z: rows=y/columns=x. Platform y=0 cells are null.
   */
  cells: readonly (readonly (BlockId | null)[])[];
}>;

export type ArenaLimits = Readonly<{
  maxBatchEdits: number;
  defaultQueryLimit: number;
  maxQueryLimit: number;
}>;

export type ArenaContext = Readonly<{
  bounds: ArenaConfig;
  revision: number;
  blockTypes: readonly BlockId[];
  limits: ArenaLimits;
}>;

export type BuildSummary = Readonly<{
  /** Counts and occupied bounds exclude the implicit protected platform. */
  revision: number;
  blockCount: number;
  counts: BlockCounts;
  occupiedBounds: Bounds | null;
}>;

export type BlockChange = Readonly<{
  position: Coordinate;
  before: BlockId | null;
  after: BlockId | null;
  /** State/objectId snapshots; keys are omitted when the cell had none. */
  beforeState?: BlockState;
  afterState?: BlockState;
  beforeObjectId?: string;
  afterObjectId?: string;
}>;

export type ArenaChange = Readonly<{
  /** Emitted only after a committed, non-no-op mutation. */
  revision: number;
  commandType: ArenaCommand["type"] | "resize_platform" | "resize_height";
  affectedBlocks: number;
  affectedBounds: Bounds | null;
  changes: readonly BlockChange[];
  undoId: string | null;
}>;

export type ArenaChangeListener = (change: ArenaChange) => void;

export interface ArenaEngine {
  apply(command: ArenaCommand): ArenaResult;
  resizePlatform(platformSize: number): ArenaResult;
  resizeHeight(buildHeight: number): ArenaResult;
  getContext(): ArenaContext;
  getSummary(): BuildSummary;
  snapshotBlocks(): readonly Block[];
  queryBlocks(query: BlockQuery): BlockQueryResult;
  getSlice(query: SliceQuery): BuildSlice;
  subscribe(listener: ArenaChangeListener): () => void;
}

/** Shared immutable values used by engine implementations and adapters. */
export const ARENA_CONTRACT_DEFAULTS = Object.freeze({
  bounds: DEFAULT_ARENA_CONFIG,
  blockTypes: ALL_BLOCK_IDS,
  limits: Object.freeze({
    maxBatchEdits: DEFAULT_MAX_BATCH_EDITS,
    defaultQueryLimit: DEFAULT_QUERY_LIMIT,
    maxQueryLimit: MAX_QUERY_LIMIT,
  }),
});
