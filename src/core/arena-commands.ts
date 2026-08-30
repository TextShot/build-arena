import type {
  ArenaCommand,
  ArenaResult,
  BlockChange,
  BlockEdit,
  ClearBlocksCommand,
  GenerateShapeCommand,
  TransformRegionCommand,
} from "./arena-engine";
import type { ArenaConfig, Bounds } from "./arena-config";
import { DEFAULT_MAX_BATCH_EDITS } from "./arena-config";
import type { BlockId, BlockState, Facing, WorldCell } from "./block-types";
import {
  blockStateKind,
  cellEquals,
  freezeCell,
  freezeOccupancy,
  mirrorFacing,
  normalizeBlockState,
  rotateFacing,
} from "./block-types";
import { coordinateKey, type Coordinate, type CoordinateKey } from "./coordinates";
import { HistoryManager } from "./history";
import {
  validateArenaPosition,
  validateBlockType,
  validateBounds,
  validateCoordinate,
  validateExpectedRevision,
  validateObjectId,
} from "./validation";

export type MutableArenaWorld = Readonly<{
  get(position: Coordinate): WorldCell | null;
  set(position: Coordinate, cell: WorldCell): void;
  remove(position: Coordinate): void;
  entries(): Iterable<{ position: Coordinate; cell: WorldCell }>;
  /** Block type already stored under this objectId, or null if the group is new. */
  groupType(objectId: string): BlockId | null;
}>;

export type CommandExecution = Readonly<{
  result: ArenaResult;
  changes: readonly BlockChange[];
  affectedBounds: Bounds | null;
  undoId: string | null;
}>;

function compareChanges(a: BlockChange, b: BlockChange): number {
  return a.position.x - b.position.x || a.position.y - b.position.y || a.position.z - b.position.z;
}

export function boundsForChanges(changes: readonly BlockChange[]): Bounds | null {
  if (changes.length === 0) return null;
  const min = { ...changes[0].position };
  const max = { ...changes[0].position };
  for (let index = 1; index < changes.length; index += 1) {
    const { position } = changes[index];
    min.x = Math.min(min.x, position.x);
    min.y = Math.min(min.y, position.y);
    min.z = Math.min(min.z, position.z);
    max.x = Math.max(max.x, position.x);
    max.y = Math.max(max.y, position.y);
    max.z = Math.max(max.z, position.z);
  }
  return Object.freeze({ min: Object.freeze(min), max: Object.freeze(max) });
}

function changeFor(position: Coordinate, before: WorldCell | null, after: WorldCell | null): BlockChange {
  return Object.freeze({
    position: Object.freeze({ ...position }),
    before: before ? freezeOccupancy(before) : null,
    after: after ? freezeOccupancy(after) : null,
  });
}

function cellFromChange(change: BlockChange, inverse: boolean): WorldCell | null {
  return inverse ? change.before : change.after;
}

function success(
  revision: number,
  changes: readonly BlockChange[],
  undoId: string | null,
  extras: Readonly<{ warnings?: readonly string[]; objectId?: string }> = {},
): CommandExecution {
  const affectedBounds = boundsForChanges(changes);
  return {
    result: {
      success: true,
      revision,
      affectedBlocks: changes.length,
      affectedBounds,
      warnings: Object.freeze([...(extras.warnings ?? [])]),
      undoId,
      ...(extras.objectId ? { objectId: extras.objectId } : {}),
    },
    changes: Object.freeze(changes),
    affectedBounds,
    undoId,
  };
}

function failed(revision: number, message: string, fieldPath: string): CommandExecution {
  return { result: { success: false, revision, error: message, fieldPath }, changes: [], affectedBounds: null, undoId: null };
}

function applyChanges(world: MutableArenaWorld, changes: readonly BlockChange[], inverse = false): void {
  for (const change of changes) {
    const cell = cellFromChange(change, inverse);
    if (cell === null) world.remove(change.position);
    else world.set(change.position, cell);
  }
}

function inverseChanges(changes: readonly BlockChange[]): readonly BlockChange[] {
  return Object.freeze(changes.map((change) =>
    changeFor(change.position, cellFromChange(change, false), cellFromChange(change, true)),
  ));
}

/**
 * Reusing an existing group appends only when its block type is compatible.
 * `pendingGroups` covers groups introduced earlier in the same batch.
 */
function checkGroupCompatibility(
  world: MutableArenaWorld,
  objectId: string,
  block: BlockId,
  pendingGroups: Map<string, BlockId>,
): string | null {
  const existing = pendingGroups.get(objectId) ?? world.groupType(objectId);
  if (existing !== null && existing !== block) {
    return `objectId "${objectId}" already groups ${existing} blocks`;
  }
  pendingGroups.set(objectId, block);
  return null;
}

function executeSetBlocks(
  world: MutableArenaWorld,
  command: Extract<ArenaCommand, { type: "set_blocks" }>,
  revision: number,
  config: ArenaConfig,
  history: HistoryManager,
): CommandExecution {
  const revisionFailure = validateExpectedRevision(command.expectedRevision, revision);
  if (revisionFailure) return failed(revision, revisionFailure.error, revisionFailure.fieldPath);
  if (!Array.isArray(command.edits)) return failed(revision, "edits must be an array", "edits");
  if (command.edits.length < 1 || command.edits.length > DEFAULT_MAX_BATCH_EDITS) {
    return failed(revision, `edits must contain 1 to ${DEFAULT_MAX_BATCH_EDITS} items`, "edits");
  }

  const seen = new Set<string>();
  const pendingGroups = new Map<string, BlockId>();
  const changes: BlockChange[] = [];
  for (let index = 0; index < command.edits.length; index += 1) {
    const edit = command.edits[index] as BlockEdit | undefined;
    const fieldPath = `edits[${index}]`;
    if (
      !edit ||
      typeof edit !== "object" ||
      (edit.action !== "place" && edit.action !== "replace" && edit.action !== "remove")
    ) {
      return failed(revision, "Unknown edit action", fieldPath);
    }
    const positionFailure = validateArenaPosition(edit.position, config, `${fieldPath}.position`);
    if (positionFailure) return failed(revision, positionFailure.error, positionFailure.fieldPath);
    const position = edit.position;
    const key = coordinateKey(position);
    if (seen.has(key)) return failed(revision, "Duplicate coordinates are not allowed", `${fieldPath}.position`);
    seen.add(key);

    const before = world.get(position);
    let after: WorldCell | null = null;
    if (edit.action !== "remove") {
      const blockFailure = validateBlockType(edit.block, `${fieldPath}.block`);
      if (blockFailure) return failed(revision, blockFailure.error, blockFailure.fieldPath);
      const normalized = normalizeBlockState(edit.block, edit.state);
      if (!normalized.ok) return failed(revision, normalized.error, `${fieldPath}.state`);
      const objectIdFailure = validateObjectId(edit.objectId, `${fieldPath}.objectId`);
      if (objectIdFailure) return failed(revision, objectIdFailure.error, objectIdFailure.fieldPath);
      if (edit.objectId) {
        const incompatible = checkGroupCompatibility(world, edit.objectId, edit.block, pendingGroups);
        if (incompatible) return failed(revision, incompatible, `${fieldPath}.objectId`);
      }
      after = freezeCell(edit.block, normalized.ok ? normalized.state : undefined, edit.objectId);
    }
    if (edit.action === "place" && before !== null) return failed(revision, "place requires an empty position", fieldPath);
    if (edit.action === "replace" && before === null) return failed(revision, "replace requires an occupied position", fieldPath);
    if (cellEquals(before, after)) continue;
    changes.push(changeFor(position, before, after));
  }

  changes.sort(compareChanges);
  if (changes.length === 0) return success(revision, changes, null);
  applyChanges(world, changes);
  const entry = history.record(changes);
  return success(revision + 1, changes, entry.id);
}

function executeHistory(
  world: MutableArenaWorld,
  command: Extract<ArenaCommand, { type: "undo" | "redo" }>,
  revision: number,
  history: HistoryManager,
): CommandExecution {
  const revisionFailure = validateExpectedRevision(command.expectedRevision, revision);
  if (revisionFailure) return failed(revision, revisionFailure.error, revisionFailure.fieldPath);
  if (command.type === "undo") {
    const entry = history.peekUndo();
    if (!entry) return failed(revision, "There is no eligible change to undo", "undoId");
    if (command.undoId !== undefined && command.undoId !== entry.id) return failed(revision, "undoId is not the latest eligible entry", "undoId");
    history.moveUndoToRedo();
    applyChanges(world, entry.changes, true);
    const changes = inverseChanges(entry.changes);
    return success(revision + 1, changes, entry.id);
  }
  const entry = history.peekRedo();
  if (!entry) return failed(revision, "There is no change to redo", "expectedRevision");
  history.moveRedoToUndo();
  applyChanges(world, entry.changes);
  return success(revision + 1, entry.changes, entry.id);
}

function regionCells(region: Bounds, shape: GenerateShapeCommand["shape"]): Coordinate[] {
  const cells: Coordinate[] = [];
  for (let x = region.min.x; x <= region.max.x; x += 1) {
    for (let y = region.min.y; y <= region.max.y; y += 1) {
      for (let z = region.min.z; z <= region.max.z; z += 1) {
        if (shape === "hollow_box") {
          const onShell = x === region.min.x || x === region.max.x ||
            y === region.min.y || y === region.max.y ||
            z === region.min.z || z === region.max.z;
          if (!onShell) continue;
        }
        cells.push({ x, y, z });
      }
    }
  }
  return cells;
}

function commitOrDryRun(
  world: MutableArenaWorld,
  changes: BlockChange[],
  revision: number,
  history: HistoryManager,
  dryRun: boolean | undefined,
  objectId?: string,
): CommandExecution {
  changes.sort(compareChanges);
  if (dryRun) {
    // Report what would change, but hand the engine an empty change list so
    // the dry run is never committed, recorded, or broadcast.
    return {
      result: {
        success: true,
        revision,
        affectedBlocks: changes.length,
        affectedBounds: boundsForChanges(changes),
        warnings: Object.freeze(["Dry run: no blocks were changed"]),
        undoId: null,
        ...(objectId ? { objectId } : {}),
      },
      changes: Object.freeze([]),
      affectedBounds: null,
      undoId: null,
    };
  }
  if (changes.length === 0) return success(revision, changes, null, { objectId });
  applyChanges(world, changes);
  const entry = history.record(changes);
  return success(revision + 1, changes, entry.id, { objectId });
}

function executeGenerateShape(
  world: MutableArenaWorld,
  command: GenerateShapeCommand,
  revision: number,
  config: ArenaConfig,
  history: HistoryManager,
): CommandExecution {
  const revisionFailure = validateExpectedRevision(command.expectedRevision, revision);
  if (revisionFailure) return failed(revision, revisionFailure.error, revisionFailure.fieldPath);
  if (command.shape !== "floor" && command.shape !== "wall" && command.shape !== "filled_box" && command.shape !== "hollow_box") {
    return failed(revision, "shape must be floor, wall, filled_box, or hollow_box", "shape");
  }
  const boundsFailure = validateBounds(command.region, config, "region");
  if (boundsFailure) return failed(revision, boundsFailure.error, boundsFailure.fieldPath);
  const region = command.region;
  if (region.min.y <= config.platformY) {
    return failed(revision, "region must stay above the protected platform", "region.min.y");
  }
  if (command.shape === "floor" && region.min.y !== region.max.y) {
    return failed(revision, "floor region must span a single Y layer", "region");
  }
  if (command.shape === "wall" && region.min.x !== region.max.x && region.min.z !== region.max.z) {
    return failed(revision, "wall region must be one block thick in X or Z", "region");
  }
  const blockFailure = validateBlockType(command.block, "block");
  if (blockFailure) return failed(revision, blockFailure.error, blockFailure.fieldPath);
  const normalized = normalizeBlockState(command.block, command.state);
  if (!normalized.ok) return failed(revision, normalized.error, "state");
  const objectIdFailure = validateObjectId(command.objectId, "objectId");
  if (objectIdFailure) return failed(revision, objectIdFailure.error, objectIdFailure.fieldPath);
  if (command.objectId) {
    const existing = world.groupType(command.objectId);
    if (existing !== null && existing !== command.block) {
      return failed(revision, `objectId "${command.objectId}" already groups ${existing} blocks`, "objectId");
    }
  }

  const after = freezeCell(command.block, normalized.ok ? normalized.state : undefined, command.objectId);
  const changes: BlockChange[] = [];
  for (const position of regionCells(region, command.shape)) {
    const before = world.get(position);
    if (cellEquals(before, after)) continue;
    changes.push(changeFor(position, before, after));
  }
  return commitOrDryRun(world, changes, revision, history, command.dryRun, command.objectId);
}

function transformFacing(
  state: BlockState | undefined,
  transform: (facing: Facing) => Facing,
): BlockState | undefined {
  if (!state?.facing) return state;
  return Object.freeze({ ...state, facing: transform(state.facing) });
}

function executeTransformRegion(
  world: MutableArenaWorld,
  command: TransformRegionCommand,
  revision: number,
  config: ArenaConfig,
  history: HistoryManager,
): CommandExecution {
  const revisionFailure = validateExpectedRevision(command.expectedRevision, revision);
  if (revisionFailure) return failed(revision, revisionFailure.error, revisionFailure.fieldPath);
  const boundsFailure = validateBounds(command.region, config, "region");
  if (boundsFailure) return failed(revision, boundsFailure.error, boundsFailure.fieldPath);
  const region = command.region;
  if (region.min.y <= config.platformY) {
    return failed(revision, "region must stay above the protected platform", "region.min.y");
  }

  const sources: { position: Coordinate; cell: WorldCell }[] = [];
  for (const entry of world.entries()) {
    const { position } = entry;
    if (
      position.x >= region.min.x && position.x <= region.max.x &&
      position.y >= region.min.y && position.y <= region.max.y &&
      position.z >= region.min.z && position.z <= region.max.z
    ) {
      sources.push(entry);
    }
  }

  const targets = new Map<CoordinateKey, { position: Coordinate; cell: WorldCell }>();
  const removals = new Map<CoordinateKey, Coordinate>();
  const operation = command.operation;

  if (operation === "copy" || operation === "move") {
    const offsetFailure = validateCoordinate(command.offset, "offset");
    if (offsetFailure) return failed(revision, offsetFailure.error, offsetFailure.fieldPath);
    const offset = command.offset as Coordinate;
    for (const { position, cell } of sources) {
      const target = { x: position.x + offset.x, y: position.y + offset.y, z: position.z + offset.z };
      const targetFailure = validateArenaPosition(target, config, "offset");
      if (targetFailure) return failed(revision, "Transformed blocks would leave the arena", "offset");
      targets.set(coordinateKey(target), { position: target, cell });
      if (operation === "move") removals.set(coordinateKey(position), position);
    }
  } else if (operation === "rotate") {
    if (command.rotation !== 90 && command.rotation !== 180 && command.rotation !== 270) {
      return failed(revision, "rotation must be 90, 180, or 270", "rotation");
    }
    const quarterTurns = command.rotation / 90;
    const sizeX = region.max.x - region.min.x + 1;
    const sizeZ = region.max.z - region.min.z + 1;
    for (const { position, cell } of sources) {
      const lx = position.x - region.min.x;
      const lz = position.z - region.min.z;
      let nx: number;
      let nz: number;
      if (quarterTurns === 1) { nx = sizeZ - 1 - lz; nz = lx; }
      else if (quarterTurns === 2) { nx = sizeX - 1 - lx; nz = sizeZ - 1 - lz; }
      else { nx = lz; nz = sizeX - 1 - lx; }
      const target = { x: region.min.x + nx, y: position.y, z: region.min.z + nz };
      const targetFailure = validateArenaPosition(target, config, "rotation");
      if (targetFailure) return failed(revision, "Rotated blocks would leave the arena", "rotation");
      const rotatedCell = freezeCell(
        cell.block,
        transformFacing(cell.state, (facing) => rotateFacing(facing, quarterTurns)),
        cell.objectId,
      );
      targets.set(coordinateKey(target), { position: target, cell: rotatedCell });
      removals.set(coordinateKey(position), position);
    }
  } else if (operation === "mirror") {
    if (command.axis !== "x" && command.axis !== "z") {
      return failed(revision, "axis must be x or z", "axis");
    }
    const axis = command.axis;
    for (const { position, cell } of sources) {
      const target = axis === "x"
        ? { x: region.min.x + (region.max.x - position.x), y: position.y, z: position.z }
        : { x: position.x, y: position.y, z: region.min.z + (region.max.z - position.z) };
      const mirroredCell = freezeCell(
        cell.block,
        transformFacing(cell.state, (facing) => mirrorFacing(facing, axis)),
        cell.objectId,
      );
      targets.set(coordinateKey(target), { position: target, cell: mirroredCell });
      removals.set(coordinateKey(position), position);
    }
  } else if (operation === "replace_type") {
    const fromFailure = validateBlockType(command.from, "from");
    if (fromFailure) return failed(revision, fromFailure.error, fromFailure.fieldPath);
    const toFailure = validateBlockType(command.to, "to");
    if (toFailure) return failed(revision, toFailure.error, toFailure.fieldPath);
    const from = command.from as BlockId;
    const to = command.to as BlockId;
    const fromKind = blockStateKind(from);
    const toKind = blockStateKind(to);
    if (toKind !== "none" && toKind !== fromKind) {
      return failed(revision, `${to} requires ${toKind} state that ${from} does not carry`, "to");
    }
    for (const { position, cell } of sources) {
      if (cell.block !== from) continue;
      const nextState = toKind === "none" ? undefined : cell.state;
      targets.set(coordinateKey(position), { position, cell: freezeCell(to, nextState, cell.objectId) });
    }
  } else {
    return failed(revision, "operation must be copy, move, rotate, mirror, or replace_type", "operation");
  }

  const changes: BlockChange[] = [];
  for (const [key, position] of removals) {
    if (targets.has(key)) continue;
    const before = world.get(position);
    if (before === null) continue;
    changes.push(changeFor(position, before, null));
  }
  for (const { position, cell } of targets.values()) {
    const before = world.get(position);
    if (cellEquals(before, cell)) continue;
    changes.push(changeFor(position, before, cell));
  }
  return commitOrDryRun(world, changes, revision, history, command.dryRun);
}

function executeClearBlocks(
  world: MutableArenaWorld,
  command: ClearBlocksCommand,
  revision: number,
  config: ArenaConfig,
  history: HistoryManager,
): CommandExecution {
  const revisionFailure = validateExpectedRevision(command.expectedRevision, revision);
  if (revisionFailure) return failed(revision, revisionFailure.error, revisionFailure.fieldPath);

  const changes: BlockChange[] = [];
  for (const { position, cell } of world.entries()) {
    if (position.y <= config.platformY) continue;
    changes.push(changeFor(position, cell, null));
  }
  return commitOrDryRun(world, changes, revision, history, false);
}

export function executeCommand(
  world: MutableArenaWorld,
  command: ArenaCommand,
  revision: number,
  config: ArenaConfig,
  history: HistoryManager,
): CommandExecution {
  if (command === null || typeof command !== "object" || typeof command.type !== "string") {
    return failed(revision, "Invalid arena command", "command");
  }
  if (command.type === "set_blocks") return executeSetBlocks(world, command, revision, config, history);
  if (command.type === "undo" || command.type === "redo") return executeHistory(world, command, revision, history);
  if (command.type === "generate_shape") return executeGenerateShape(world, command, revision, config, history);
  if (command.type === "transform_region") return executeTransformRegion(world, command, revision, config, history);
  if (command.type === "clear_blocks") return executeClearBlocks(world, command, revision, config, history);
  return failed(revision, "Unknown arena command type", "type");
}
