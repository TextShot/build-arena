import type { ArenaConfig } from "./arena-config";
import { DEFAULT_ARENA_CONFIG, DEFAULT_MAX_BATCH_EDITS, DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT } from "./arena-config";
import type { ArenaChange, ArenaContext, ArenaEngine, ArenaResult, BlockQuery, BuildSlice, BuildSummary, SliceQuery } from "./arena-engine";
import type { BlockId } from "./block-types";
import { PHASE_A_BLOCK_IDS } from "./block-types";
import { coordinateFromKey, coordinateKey, type Coordinate, type CoordinateKey } from "./coordinates";
import { executeCommand, type MutableArenaWorld } from "./arena-commands";
import { HistoryManager } from "./history";
import { getSlice, getSummary, queryBlocks, type QueryWorld } from "./arena-queries";

type SparseArenaWorld = MutableArenaWorld & QueryWorld;

export function createArenaEngine(): ArenaEngine {
  const config: ArenaConfig = DEFAULT_ARENA_CONFIG;
  const blocks = new Map<CoordinateKey, BlockId>();
  let revision = 0;
  const history = new HistoryManager();
  const listeners = new Set<(change: ArenaChange) => void>();

  const world: SparseArenaWorld = {
    get(position: Coordinate): BlockId | null {
      return blocks.get(coordinateKey(position)) ?? null;
    },
    set(position: Coordinate, block: BlockId): void {
      blocks.set(coordinateKey(position), block);
    },
    remove(position: Coordinate): void {
      blocks.delete(coordinateKey(position));
    },
    entries(): Iterable<{ position: Coordinate; block: BlockId }> {
      return Array.from(blocks, ([key, block]) => ({
        position: coordinateFromKey(key),
        block,
      }));
    },
  };

  const engine: ArenaEngine = {
    apply(command): ArenaResult {
      const execution = executeCommand(world, command, revision, config, history);
      if (!execution.result.success || execution.changes.length === 0) return execution.result;
      if (execution.affectedBounds === null || execution.undoId === null) {
        throw new Error("Committed arena changes require bounds and an undo id");
      }
      revision = execution.result.revision;
      const event: ArenaChange = Object.freeze({
        revision,
        commandType: command.type,
        affectedBlocks: execution.changes.length,
        affectedBounds: execution.affectedBounds,
        changes: execution.changes,
        undoId: execution.undoId,
      });
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // A subscriber cannot make a committed core mutation fail.
        }
      }
      return execution.result;
    },
    getContext(): ArenaContext {
      return Object.freeze({
        bounds: config,
        revision,
        blockTypes: PHASE_A_BLOCK_IDS,
        limits: Object.freeze({
          maxBatchEdits: DEFAULT_MAX_BATCH_EDITS,
          defaultQueryLimit: DEFAULT_QUERY_LIMIT,
          maxQueryLimit: MAX_QUERY_LIMIT,
        }),
      });
    },
    getSummary(): BuildSummary {
      return getSummary(world, revision);
    },
    queryBlocks(query: BlockQuery): ReturnType<typeof queryBlocks> {
      return queryBlocks(world, query, config, revision);
    },
    getSlice(query: SliceQuery): BuildSlice {
      return getSlice(world, query, config, revision);
    },
    subscribe(listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return engine;
}
