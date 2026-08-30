import type { ArenaConfig } from "./arena-config";
import { createArenaConfig, DEFAULT_ARENA_CONFIG, DEFAULT_MAX_BATCH_EDITS, DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT, platformSizeForConfig } from "./arena-config";
import type { ArenaChange, ArenaContext, ArenaEngine, ArenaResult, BlockQuery, BuildSlice, BuildSummary, SliceQuery, WorldCell } from "./arena-engine";
import { ALL_BLOCK_IDS, type BlockId } from "./block-types";
import { coordinateFromKey, coordinateKey, type Coordinate, type CoordinateKey } from "./coordinates";
import { executeCommand, type MutableArenaWorld } from "./arena-commands";
import { HistoryManager } from "./history";
import {
  applyObjectGroupChanges,
  getSlice,
  getSummary,
  queryBlocks,
  snapshotBlocks,
  snapshotObjectGroups,
  type ObjectGroupRecord,
  type QueryWorld,
} from "./arena-queries";

type SparseArenaWorld = MutableArenaWorld & QueryWorld;

export function createArenaEngine(initialConfig: ArenaConfig = DEFAULT_ARENA_CONFIG): ArenaEngine {
  let config: ArenaConfig = initialConfig;
  const blocks = new Map<CoordinateKey, WorldCell>();
  const groups = new Map<string, ObjectGroupRecord>();
  let revision = 0;
  const history = new HistoryManager();
  const listeners = new Set<(change: ArenaChange) => void>();

  const world: SparseArenaWorld = {
    get(position: Coordinate): WorldCell | null {
      return blocks.get(coordinateKey(position)) ?? null;
    },
    set(position: Coordinate, cell: WorldCell): void {
      blocks.set(coordinateKey(position), cell);
    },
    remove(position: Coordinate): void {
      blocks.delete(coordinateKey(position));
    },
    entries(): Iterable<{ position: Coordinate; cell: WorldCell }> {
      return Array.from(blocks, ([key, cell]) => ({
        position: coordinateFromKey(key),
        cell,
      }));
    },
    groupType(objectId: string): BlockId | null {
      return groups.get(objectId)?.block ?? null;
    },
  };

  const resizeArena = (
    nextConfig: ArenaConfig,
    fieldPath: "platformSize" | "buildHeight",
    commandType: "resize_platform" | "resize_height",
    destructiveError: string,
  ): ArenaResult => {
    if (
      nextConfig.minX === config.minX &&
      nextConfig.maxX === config.maxX &&
      nextConfig.maxY === config.maxY &&
      nextConfig.minZ === config.minZ &&
      nextConfig.maxZ === config.maxZ
    ) {
      return {
        success: true,
        revision,
        affectedBlocks: 0,
        affectedBounds: null,
        warnings: Object.freeze([]),
        undoId: null,
      };
    }
    for (const { position } of world.entries()) {
      if (
        position.x < nextConfig.minX || position.x > nextConfig.maxX ||
        position.y < nextConfig.minY || position.y > nextConfig.maxY ||
        position.z < nextConfig.minZ || position.z > nextConfig.maxZ
      ) {
        return { success: false, revision, error: destructiveError, fieldPath };
      }
    }
    const isShrinking = nextConfig.maxX < config.maxX ||
      nextConfig.maxY < config.maxY ||
      nextConfig.maxZ < config.maxZ;
    config = nextConfig;
    if (isShrinking) history.clear();
    revision += 1;
    const affectedBounds = Object.freeze({
      min: Object.freeze({ x: config.minX, y: config.minY, z: config.minZ }),
      max: Object.freeze({ x: config.maxX, y: config.maxY, z: config.maxZ }),
    });
    const event: ArenaChange = Object.freeze({
      revision,
      commandType,
      affectedBlocks: 0,
      affectedBounds,
      changes: Object.freeze([]),
      undoId: null,
    });
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // A subscriber cannot make a committed core mutation fail.
      }
    }
    return {
      success: true,
      revision,
      affectedBlocks: 0,
      affectedBounds,
      warnings: Object.freeze([]),
      undoId: null,
    };
  };

  const engine: ArenaEngine = {
    apply(command): ArenaResult {
      const execution = executeCommand(world, command, revision, config, history);
      if (!execution.result.success || execution.changes.length === 0) return execution.result;
      if (execution.affectedBounds === null || execution.undoId === null) {
        throw new Error("Committed arena changes require bounds and an undo id");
      }
      applyObjectGroupChanges(groups, execution.changes);
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
    resizePlatform(platformSize): ArenaResult {
      try {
        return resizeArena(
          createArenaConfig(platformSize, config.maxY),
          "platformSize",
          "resize_platform",
          "Platform cannot shrink around existing blocks",
        );
      } catch (error) {
        return {
          success: false,
          revision,
          error: error instanceof Error ? error.message : "Invalid platform size",
          fieldPath: "platformSize",
        };
      }
    },
    resizeHeight(buildHeight): ArenaResult {
      try {
        return resizeArena(
          createArenaConfig(platformSizeForConfig(config), buildHeight),
          "buildHeight",
          "resize_height",
          "Height cannot shrink around existing blocks",
        );
      } catch (error) {
        return {
          success: false,
          revision,
          error: error instanceof Error ? error.message : "Invalid build height",
          fieldPath: "buildHeight",
        };
      }
    },
    getContext(): ArenaContext {
      return Object.freeze({
        bounds: config,
        revision,
        blockTypes: ALL_BLOCK_IDS,
        limits: Object.freeze({
          maxBatchEdits: DEFAULT_MAX_BATCH_EDITS,
          defaultQueryLimit: DEFAULT_QUERY_LIMIT,
          maxQueryLimit: MAX_QUERY_LIMIT,
        }),
      });
    },
    getSummary(): BuildSummary {
      return getSummary(world, revision, snapshotObjectGroups(groups));
    },
    snapshotBlocks() {
      return snapshotBlocks(world);
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
