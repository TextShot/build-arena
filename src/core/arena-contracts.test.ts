import { describe, expect, it } from "vitest";

import {
  DEFAULT_ARENA_CONFIG,
  PHASE_A_BLOCK_IDS,
  type ArenaCommand,
  type ArenaResult,
  type BlockEdit,
  type BuildSlice,
} from "./arena-engine";
import {
  coordinateFromKey,
  coordinateKey,
  type Coordinate,
} from "./coordinates";

describe("arena contracts", () => {
  it("exposes a centred immutable 7x7 foundation", () => {
    expect(DEFAULT_ARENA_CONFIG).toEqual({
      minX: -3,
      maxX: 3,
      minY: 0,
      maxY: 6,
      minZ: -3,
      maxZ: 3,
      platformY: 0,
    });
    expect(Object.isFrozen(DEFAULT_ARENA_CONFIG)).toBe(true);
    expect(PHASE_A_BLOCK_IDS).toEqual([
      "dirt",
      "stone",
      "oak_log",
      "oak_planks",
      "leaves",
      "glass",
      "obsidian",
    ]);
  });

  it("describes atomic set, undo, and redo commands", () => {
    const position: Coordinate = { x: 0, y: 1, z: 0 };
    const edits: readonly BlockEdit[] = [
      { action: "place", position, block: "stone" },
      { action: "replace", position: { x: 1, y: 1, z: 0 }, block: "glass" },
      { action: "remove", position: { x: -1, y: 1, z: 0 } },
    ];
    const commands: readonly ArenaCommand[] = [
      { type: "set_blocks", expectedRevision: 0, edits },
      { type: "undo", expectedRevision: 1 },
      { type: "redo", expectedRevision: 2 },
    ];

    expect(commands[0]).toMatchObject({ type: "set_blocks", expectedRevision: 0 });
    expect(commands[1]).toEqual({ type: "undo", expectedRevision: 1 });
    expect(commands[2]).toEqual({ type: "redo", expectedRevision: 2 });
  });

  it("describes an exact matrix slice fixture", () => {
    const result: ArenaResult = {
      success: false,
      revision: 0,
      error: "not implemented",
    };
    const slice: BuildSlice = {
      axis: "y",
      index: 1,
      revision: 0,
      rowAxis: "z",
      columnAxis: "x",
      rowCoordinates: [-3, -2, -1, 0, 1, 2, 3],
      columnCoordinates: [-3, -2, -1, 0, 1, 2, 3],
      cells: [
        [null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
      ],
    };

    expect(result.success).toBe(false);
    expect(slice.cells).toHaveLength(7);
    expect(slice.cells[0]).toHaveLength(7);
  });

  it("round-trips zero and negative integer coordinates", () => {
    const coordinate = { x: -12, y: 0, z: 34 } as const;
    const key = coordinateKey(coordinate);

    expect(key).toBe("-12,0,34");
    expect(coordinateFromKey(key)).toEqual(coordinate);
  });

  it("rejects invalid coordinate values and malformed keys", () => {
    expect(() => coordinateKey({ x: 1.5, y: 0, z: 0 })).toThrow();
    expect(() => coordinateKey({ x: Number.NaN, y: 0, z: 0 })).toThrow();
    expect(() => coordinateKey({ x: Number.POSITIVE_INFINITY, y: 0, z: 0 })).toThrow();
    expect(() => coordinateKey({ x: Number.MAX_SAFE_INTEGER + 1, y: 0, z: 0 })).toThrow();

    const malformedKeys = [
      "1.5,0,0",
      "NaN,0,0",
      "Infinity,0,0",
      "1,0",
      "1,0,0,2",
      "01,0,0",
      "-0,0,0",
      "0,-0,0",
      "0,0,-0",
      "9007199254740992,0,0",
    ];
    for (const key of malformedKeys) {
      expect(() => coordinateFromKey(key)).toThrow();
    }
  });

  it("allows a valid no-op without inventing history", () => {
    const result: ArenaResult = {
      success: true,
      revision: 4,
      affectedBlocks: 0,
      affectedBounds: null,
      warnings: [],
      undoId: null,
    };

    expect(result.affectedBlocks).toBe(0);
    expect(result.undoId).toBeNull();
  });
});
