import { describe, expect, it } from "vitest";

import { createArenaEngine } from "./arena-world";

const position = (x: number, y = 1, z = 0) => ({ x, y, z });

describe("arena commands", () => {
  it("commits a batch atomically, increments once, and emits one exact event", () => {
    const engine = createArenaEngine();
    const events: unknown[] = [];
    engine.subscribe((event) => events.push(event));

    const result = engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [
        { action: "place", position: position(1), block: "stone" },
        { action: "place", position: position(-1), block: "glass" },
      ],
    });

    expect(result).toMatchObject({
      success: true,
      revision: 1,
      affectedBlocks: 2,
      affectedBounds: { min: position(-1), max: position(1) },
    });
    expect(result.success && result.undoId).toEqual(expect.any(String));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      revision: 1,
      commandType: "set_blocks",
      affectedBlocks: 2,
      changes: [
        { position: position(-1), before: null, after: "glass" },
        { position: position(1), before: null, after: "stone" },
      ],
    });
  });

  it("prevalidates the full batch and preserves state on any failure", () => {
    const engine = createArenaEngine();
    engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{ action: "place", position: position(0), block: "stone" }],
    });

    const result = engine.apply({
      type: "set_blocks",
      expectedRevision: 1,
      edits: [
        { action: "place", position: position(2), block: "glass" },
        { action: "place", position: position(0), block: "dirt" },
      ],
    });

    expect(result).toMatchObject({ success: false, revision: 1, fieldPath: "edits[1]" });
    expect(engine.queryBlocks({}).blocks).toEqual([
      { position: position(0), block: "stone" },
    ]);
  });

  it("rejects stale revisions, duplicate coordinates, invalid bounds, and oversized batches", () => {
    const engine = createArenaEngine();
    const stale = engine.apply({ type: "set_blocks", expectedRevision: 2, edits: [] });
    const duplicate = engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [
        { action: "place", position: position(0), block: "stone" },
        { action: "place", position: position(0), block: "glass" },
      ],
    });
    const outOfBounds = engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{ action: "place", position: position(4), block: "stone" }],
    });
    const oversized = engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: Array.from({ length: 257 }, (_, x) => ({
        action: "place" as const,
        position: position(x - 3, 1, 1),
        block: "stone" as const,
      })),
    });

    expect(stale).toMatchObject({ success: false, revision: 0, fieldPath: "expectedRevision" });
    expect(duplicate).toMatchObject({ success: false, revision: 0, fieldPath: "edits[1].position" });
    expect(outOfBounds).toMatchObject({ success: false, revision: 0, fieldPath: "edits[0].position" });
    expect(oversized).toMatchObject({ success: false, revision: 0, fieldPath: "edits" });
    expect(engine.getSummary().blockCount).toBe(0);
  });

  it("accepts the maximum 256 unique edits", () => {
    const engine = createArenaEngine();
    const edits = Array.from({ length: 256 }, (_, index) => ({
      action: "place" as const,
      position: {
        x: (index % 7) - 3,
        y: Math.floor(index / 49) + 1,
        z: (Math.floor(index / 7) % 7) - 3,
      },
      block: "stone" as const,
    }));

    expect(engine.apply({ type: "set_blocks", expectedRevision: 0, edits })).toMatchObject({
      success: true,
      revision: 1,
      affectedBlocks: 256,
    });
    expect(engine.getSummary().blockCount).toBe(256);
  });

  it("rejects replace on air and malformed runtime block input", () => {
    const engine = createArenaEngine();
    const replaceAir = engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{ action: "replace", position: position(0), block: "stone" }],
    });
    const unknownBlock = engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{ action: "place", position: position(0), block: "unknown" as never }],
    });

    expect(replaceAir).toMatchObject({ success: false, revision: 0, fieldPath: "edits[0]" });
    expect(unknownBlock).toMatchObject({ success: false, revision: 0, fieldPath: "edits[0].block" });
    expect(engine.getSummary().blockCount).toBe(0);
  });

  it("treats remove-empty and replace-same as no-ops", () => {
    const engine = createArenaEngine();
    const events: unknown[] = [];
    engine.subscribe((event) => events.push(event));

    const remove = engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{ action: "remove", position: position(0) }],
    });
    engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{ action: "place", position: position(0), block: "stone" }],
    });
    const replace = engine.apply({
      type: "set_blocks",
      expectedRevision: 1,
      edits: [{ action: "replace", position: position(0), block: "stone" }],
    });

    expect(remove).toMatchObject({ success: true, revision: 0, affectedBlocks: 0, affectedBounds: null, undoId: null });
    expect(replace).toMatchObject({ success: true, revision: 1, affectedBlocks: 0, affectedBounds: null, undoId: null });
    expect(events).toHaveLength(1);
  });

  it("undoes and redoes exact changes, then clears redo after a new mutation", () => {
    const engine = createArenaEngine();
    const first = engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{ action: "place", position: position(0), block: "stone" }],
    });
    const second = engine.apply({
      type: "set_blocks",
      expectedRevision: 1,
      edits: [{ action: "place", position: position(1), block: "glass" }],
    });

    const undo = engine.apply({ type: "undo", expectedRevision: 2 });
    expect(undo).toMatchObject({ success: true, revision: 3, affectedBlocks: 1 });
    expect(engine.queryBlocks({}).blocks).toEqual([{ position: position(0), block: "stone" }]);

    const redo = engine.apply({ type: "redo", expectedRevision: 3 });
    expect(redo).toMatchObject({ success: true, revision: 4, affectedBlocks: 1 });
    expect(engine.queryBlocks({}).blocks).toHaveLength(2);

    engine.apply({ type: "undo", expectedRevision: 4 });
    const replacement = engine.apply({
      type: "set_blocks",
      expectedRevision: 5,
      edits: [{ action: "place", position: position(2), block: "dirt" }],
    });
    const redoAfterNewMutation = engine.apply({ type: "redo", expectedRevision: 6 });

    expect(first.success && first.undoId).toEqual(expect.any(String));
    expect(second.success && second.undoId).toEqual(expect.any(String));
    expect(replacement).toMatchObject({ success: true, revision: 6 });
    expect(redoAfterNewMutation).toMatchObject({ success: false, revision: 6 });
  });

  it("requires the latest eligible undo id", () => {
    const engine = createArenaEngine();
    const first = engine.apply({
      type: "set_blocks",
      expectedRevision: 0,
      edits: [{ action: "place", position: position(0), block: "stone" }],
    });
    engine.apply({
      type: "set_blocks",
      expectedRevision: 1,
      edits: [{ action: "place", position: position(1), block: "glass" }],
    });

    const result = engine.apply({
      type: "undo",
      expectedRevision: 2,
      undoId: first.success ? first.undoId ?? undefined : undefined,
    });
    expect(result).toMatchObject({ success: false, revision: 2, fieldPath: "undoId" });
  });
});
