import { describe, expect, it } from "vitest";

import {
  applyWorldBlockState,
  EditHistory,
  editActionFromKey,
  ManualEditor,
  readWorldBlockState,
  readWorldBlockRevision,
} from "./edit-history.js";

function createHarness(limit = 100) {
  const blocks = new Map();
  const blockRevisions = new Map();
  let nextRevision = 1;
  const positionKey = ([x, y, z]) => `${x},${y},${z}`;
  const readState = (position) => blocks.get(positionKey(position)) ?? null;
  const applyState = (position, state) => {
    const key = positionKey(position);
    if (state) blocks.set(key, { ...state });
    else blocks.delete(key);
    blockRevisions.set(key, nextRevision++);
  };
  const readRevision = (position) => blockRevisions.get(positionKey(position)) ?? 0;
  const history = new EditHistory({ readState, applyState, readRevision, limit });
  return { blocks, blockRevisions, history, readState, readRevision, applyState };
}

describe("EditHistory", () => {
  it("undoes and redoes a placed block", () => {
    const { history, readState, applyState } = createHarness();
    const position = [1, 2, 3];
    const stone = { id: "stone" };
    applyState(position, stone);
    history.record(position, null, stone);

    expect(history.undo()).toEqual({ status: "applied" });
    expect(readState(position)).toBeNull();
    expect(history.redo()).toEqual({ status: "applied" });
    expect(readState(position)).toEqual(stone);
  });

  it("restores overwritten block state including direction and mode", () => {
    const { history, readState, applyState } = createHarness();
    const position = [0, 0, 0];
    const before = { id: "comparator", facing: "N", mode: "subtract" };
    const after = { id: "repeater", facing: "E" };
    applyState(position, after);
    history.record(position, before, after);

    history.undo();
    expect(readState(position)).toEqual(before);
    history.redo();
    expect(readState(position)).toEqual(after);
  });

  it("clears redo when a new edit is recorded", () => {
    const { history, applyState } = createHarness();
    applyState([0, 0, 0], { id: "stone" });
    history.record([0, 0, 0], null, { id: "stone" });
    history.undo();

    applyState([1, 0, 0], { id: "grass" });
    history.record([1, 0, 0], null, { id: "grass" });

    expect(history.redo()).toEqual({ status: "empty" });
  });

  it("keeps only the configured number of newest edits", () => {
    const { history, readState, applyState } = createHarness(2);
    for (let x = 0; x < 3; x++) {
      applyState([x, 0, 0], { id: "stone" });
      history.record([x, 0, 0], null, { id: "stone" });
    }

    history.undo();
    history.undo();
    expect(history.undo()).toEqual({ status: "empty" });
    expect(readState([0, 0, 0])).toEqual({ id: "stone" });
  });

  it("resets history instead of overwriting an externally changed block", () => {
    const { history, readState, applyState } = createHarness();
    const position = [0, 0, 0];
    applyState(position, { id: "stone" });
    history.record(position, null, { id: "stone" });
    applyState(position, { id: "lever", on: true });

    expect(history.undo()).toEqual({ status: "conflict" });
    expect(readState(position)).toEqual({ id: "lever", on: true });
    expect(history.undo()).toEqual({ status: "empty" });
  });

  it("does not treat lever usage as a structural history conflict", () => {
    const { blocks, history, readState, applyState } = createHarness();
    const position = [0, 0, 0];
    applyState(position, { id: "lever", on: false });
    history.record(position, null, { id: "lever", on: false });
    blocks.set("0,0,0", { id: "lever", on: true });

    expect(history.undo()).toEqual({ status: "applied" });
    expect(readState(position)).toBeNull();
  });

  it("keeps edited Sign text when its placement is undone and redone", () => {
    const { blocks, history, readState, applyState } = createHarness();
    const position = [0, 0, 0];
    applyState(position, { id: "oak_sign", facing: "N", text: "" });
    history.record(position, null, { id: "oak_sign", facing: "N", text: "" });
    blocks.set("0,0,0", { id: "oak_sign", facing: "N", text: "Hello" });

    history.undo();
    history.redo();
    expect(readState(position)).toEqual({ id: "oak_sign", facing: "N", text: "Hello" });
  });

  it("detects an external rewrite even when the block state looks identical", () => {
    const { history, readState, applyState } = createHarness();
    const position = [0, 0, 0];
    applyState(position, { id: "stone" });
    history.record(position, null, { id: "stone" });
    applyState(position, { id: "stone" });

    expect(history.undo()).toEqual({ status: "conflict" });
    expect(readState(position)).toEqual({ id: "stone" });
  });

  it("undoes and redoes consecutive edits on the same block", () => {
    const { history, readState, applyState } = createHarness();
    const position = [0, 0, 0];
    const east = { id: "repeater", facing: "E" };
    const south = { id: "repeater", facing: "S" };
    applyState(position, east);
    history.record(position, null, east);
    applyState(position, south);
    history.record(position, east, south);

    expect(history.undo()).toEqual({ status: "applied" });
    expect(readState(position)).toEqual(east);
    expect(history.undo()).toEqual({ status: "applied" });
    expect(readState(position)).toBeNull();
    expect(history.redo()).toEqual({ status: "applied" });
    expect(readState(position)).toEqual(east);
    expect(history.redo()).toEqual({ status: "applied" });
    expect(readState(position)).toEqual(south);
  });

  it("keeps earlier history valid after a manual same-state rewrite", () => {
    const { history, readState, readRevision, applyState } = createHarness();
    const position = [0, 0, 0];
    const stone = { id: "stone" };
    applyState(position, stone);
    history.record(position, null, stone);
    const beforeRevision = readRevision(position);
    applyState(position, stone);
    history.record(position, stone, stone, {
      before: beforeRevision,
      after: readRevision(position),
    });

    expect(history.undo()).toEqual({ status: "applied" });
    expect(readState(position)).toBeNull();
  });

  it("does not let a manual same-state rewrite hide an earlier automated rewrite", () => {
    const { history, readRevision, applyState } = createHarness();
    const position = [0, 0, 0];
    const stone = { id: "stone" };
    applyState(position, stone);
    history.record(position, null, stone);
    applyState(position, stone);
    const beforeRevision = readRevision(position);
    applyState(position, stone);
    history.record(position, stone, stone, {
      before: beforeRevision,
      after: readRevision(position),
    });

    expect(history.undo()).toEqual({ status: "conflict" });
  });
});

describe("editActionFromKey", () => {
  it("maps standard undo, redo, and lock shortcuts", () => {
    expect(editActionFromKey({ code: "KeyZ", ctrlKey: true })).toBe("undo");
    expect(editActionFromKey({ code: "KeyZ", metaKey: true, shiftKey: true })).toBe("redo");
    expect(editActionFromKey({ code: "KeyL" })).toBe("toggle-lock");
  });

  it("ignores repeated lock presses and typing targets", () => {
    expect(editActionFromKey({ code: "KeyL", repeat: true })).toBeNull();
    expect(editActionFromKey({ code: "KeyL", target: { tagName: "TEXTAREA" } })).toBeNull();
    expect(editActionFromKey({ code: "KeyZ", metaKey: true, target: { isContentEditable: true } })).toBeNull();
  });
});

describe("world block state adapters", () => {
  it("reads a detached copy of the complete block state", () => {
    const blocks = new Map([["1,2,3", { id: "comparator", facing: "N", mode: "subtract" }]]);
    const snapshot = readWorldBlockState({ blocks }, [1, 2, 3]);
    blocks.get("1,2,3").facing = "S";

    expect(snapshot).toEqual({ id: "comparator", facing: "N", mode: "subtract" });
  });

  it("reads the structural revision for one world position", () => {
    const world = { blockRevisions: new Map([["1,2,3", 7]]) };
    expect(readWorldBlockRevision(world, [1, 2, 3])).toBe(7);
    expect(readWorldBlockRevision(world, [9, 9, 9])).toBe(0);
  });

  it("restores interactive state after placing the block", () => {
    const world = {
      blocks: new Map(),
      place(x, y, z, id, state) {
        this.blocks.set(`${x},${y},${z}`, { id, facing: state.facing, mode: state.mode, on: false });
      },
      remove(x, y, z) {
        this.blocks.delete(`${x},${y},${z}`);
      },
      refresh() {},
    };

    applyWorldBlockState(world, [0, 0, 0], { id: "lever", on: true });
    expect(world.blocks.get("0,0,0")).toEqual({
      id: "lever",
      facing: undefined,
      mode: undefined,
      on: true,
    });

    applyWorldBlockState(world, [0, 0, 0], null);
    expect(world.blocks.has("0,0,0")).toBe(false);
  });
});

describe("ManualEditor", () => {
  function createWorld() {
    return {
      blocks: new Map(),
      place(x, y, z, id, state = {}) {
        this.blocks.set(`${x},${y},${z}`, { id, ...state });
        return true;
      },
      remove(x, y, z) {
        return this.blocks.delete(`${x},${y},${z}`);
      },
      refresh() {},
    };
  }

  it("blocks structural edits and history while locked", () => {
    const world = createWorld();
    const editor = new ManualEditor(world);
    editor.toggleLocked();

    expect(editor.edit([0, 0, 0], () => world.place(0, 0, 0, "stone"))).toEqual({ status: "locked" });
    expect(world.blocks.size).toBe(0);

    editor.toggleLocked();
    editor.edit([0, 0, 0], () => world.place(0, 0, 0, "stone"));
    editor.toggleLocked();
    expect(editor.undo()).toEqual({ status: "locked" });
    expect(world.blocks.get("0,0,0")).toEqual({ id: "stone" });
  });

  it("records a direct edit and makes it undoable", () => {
    const world = createWorld();
    const editor = new ManualEditor(world);

    expect(editor.edit([1, 0, 1], () => world.place(1, 0, 1, "repeater", { facing: "S" })))
      .toEqual({ status: "applied" });
    expect(editor.undo()).toEqual({ status: "applied" });
    expect(world.blocks.has("1,0,1")).toBe(false);
  });
});
