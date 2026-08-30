import type { ArenaCommand, ArenaResult, BlockChange, BlockEdit } from "./arena-engine";
import type { ArenaConfig, Bounds } from "./arena-config";
import { DEFAULT_MAX_BATCH_EDITS } from "./arena-config";
import type { BlockId } from "./block-types";
import { coordinateKey, type Coordinate } from "./coordinates";
import { HistoryManager } from "./history";
import { validateArenaPosition, validateBlockType, validateExpectedRevision } from "./validation";

export type MutableArenaWorld = Readonly<{
  get(position: Coordinate): BlockId | null;
  set(position: Coordinate, block: BlockId): void;
  remove(position: Coordinate): void;
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
  const positions = changes.map((change) => change.position);
  const min = {
    x: Math.min(...positions.map((position) => position.x)),
    y: Math.min(...positions.map((position) => position.y)),
    z: Math.min(...positions.map((position) => position.z)),
  };
  const max = {
    x: Math.max(...positions.map((position) => position.x)),
    y: Math.max(...positions.map((position) => position.y)),
    z: Math.max(...positions.map((position) => position.z)),
  };
  return Object.freeze({ min: Object.freeze(min), max: Object.freeze(max) });
}

function success(revision: number, changes: readonly BlockChange[], undoId: string | null): CommandExecution {
  const affectedBounds = boundsForChanges(changes);
  return {
    result: {
      success: true,
      revision,
      affectedBlocks: changes.length,
      affectedBounds,
      warnings: Object.freeze([]),
      undoId,
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
    const block = inverse ? change.before : change.after;
    if (block === null) world.remove(change.position);
    else world.set(change.position, block);
  }
}

function inverseChanges(changes: readonly BlockChange[]): readonly BlockChange[] {
  return Object.freeze(changes.map((change) => Object.freeze({
    position: Object.freeze({ ...change.position }),
    before: change.after,
    after: change.before,
  })));
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
    if (edit.action !== "remove") {
      const blockFailure = validateBlockType(edit.block, `${fieldPath}.block`);
      if (blockFailure) return failed(revision, blockFailure.error, blockFailure.fieldPath);
    }

    const before = world.get(position);
    const after = edit.action === "remove" ? null : edit.block;
    if (edit.action === "place" && before !== null) return failed(revision, "place requires an empty position", fieldPath);
    if (edit.action === "replace" && before === null) return failed(revision, "replace requires an occupied position", fieldPath);
    if (before === after) continue;
    changes.push(Object.freeze({ position: Object.freeze({ ...position }), before, after }));
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
  return failed(revision, "Unknown arena command type", "type");
}
