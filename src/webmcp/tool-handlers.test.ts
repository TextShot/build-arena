import { describe, expect, it } from "vitest";

import { createArenaConfig } from "../core/arena-config";
import { createArenaEngine } from "../core/arena-world";
import { createManualEditLock } from "./manual-edit-lock";
import { createArenaToolHandlers } from "./tool-handlers";
import { ARENA_TOOL_SCHEMAS } from "./tool-schemas";
import type { ToolCallResult } from "./webmcp-types";

function payload(result: ToolCallResult): Record<string, unknown> {
  return JSON.parse(result.content[0]?.text ?? "{}") as Record<string, unknown>;
}

function testHandlers(engine = createArenaEngine()) {
  const manualEditLock = createManualEditLock();
  const handlers = createArenaToolHandlers(engine, { manualEditLock });
  return { engine, handlers, manualEditLock };
}

describe("arena tool handlers", () => {
  it("reads never mutate the revision", () => {
    const { engine, handlers } = testHandlers();

    const context = payload(handlers.get_arena_context({}));
    const summary = payload(handlers.get_build_summary({}));
    handlers.query_blocks({});
    handlers.get_build_slices({ axis: "y", index: 1 });
    handlers.render_build_views({});

    expect(context.revision).toBe(0);
    expect(context.toolUse).toEqual(expect.stringContaining("list_tools"));
    expect(summary.revision).toBe(0);
    expect(engine.getContext().revision).toBe(0);
  });

  it("rejects schema-invalid arguments with a field path and no mutation", () => {
    const { engine, handlers } = testHandlers();

    const result = handlers.set_blocks({
      expectedRevision: 0,
      edits: [{ action: "place", position: { x: 0, y: 1, z: 0 }, block: "stone" }],
      extra: true,
    });

    expect(result.isError).toBe(true);
    expect(engine.getContext().revision).toBe(0);
  });

  it("applies writes through the shared engine and fails stale writes atomically", () => {
    const { engine, handlers } = testHandlers();
    handlers.set_manual_edit_lock({ locked: true });

    const write = payload(handlers.set_blocks({
      expectedRevision: 0,
      edits: [{ action: "place", position: { x: 0, y: 1, z: 0 }, block: "stone" }],
    }));
    expect(write).toMatchObject({ success: true, revision: 1, affectedBlocks: 1 });

    const stale = handlers.set_blocks({
      expectedRevision: 0,
      edits: [{ action: "place", position: { x: 1, y: 1, z: 0 }, block: "glass" }],
    });
    expect(stale.isError).toBe(true);
    expect(payload(stale)).toMatchObject({ fieldPath: "expectedRevision" });
    expect(engine.getSummary().blockCount).toBe(1);

    const undo = payload(handlers.undo_build_change({ expectedRevision: 1 }));
    expect(undo).toMatchObject({ success: true, revision: 2 });
    expect(engine.getSummary().blockCount).toBe(0);
  });

  it("generate_shape accepts the compact DSL and groups the result", () => {
    const engine = createArenaEngine(createArenaConfig(11));
    const { handlers } = testHandlers(engine);
    handlers.set_manual_edit_lock({ locked: true });

    const result = payload(handlers.generate_shape({
      expectedRevision: 0,
      pattern: "oak_planks_1@0,1,0-(x5)",
    }));

    expect(result).toMatchObject({ success: true, affectedBlocks: 5, objectId: "oak_planks_1" });
    const summary = payload(handlers.get_build_summary({}));
    expect(summary.objectGroups).toEqual([{ objectId: "oak_planks_1", block: "oak_planks", count: 5 }]);
  });

  it("generate_shape dryRun reports without mutating", () => {
    const { engine, handlers } = testHandlers();
    handlers.set_manual_edit_lock({ locked: true });

    const result = payload(handlers.generate_shape({
      expectedRevision: 0,
      shape: "floor",
      region: { min: { x: -1, y: 1, z: -1 }, max: { x: 1, y: 1, z: 1 } },
      block: "dirt",
      dryRun: true,
    }));

    expect(result).toMatchObject({ success: true, revision: 0, affectedBlocks: 9 });
    expect(engine.getSummary().blockCount).toBe(0);
  });

  it("transform_region works and render_build_views reports metadata plus hook", () => {
    const engine = createArenaEngine();
    const views: string[] = [];
    const manualEditLock = createManualEditLock();
    const handlers = createArenaToolHandlers(engine, {
      manualEditLock,
      onRenderView: (view) => views.push(view),
    });
    handlers.set_manual_edit_lock({ locked: true });

    handlers.set_blocks({
      expectedRevision: 0,
      edits: [{ action: "place", position: { x: -1, y: 1, z: 0 }, block: "stone" }],
    });
    const moved = payload(handlers.transform_region({
      expectedRevision: 1,
      operation: "move",
      region: { min: { x: -1, y: 1, z: 0 }, max: { x: -1, y: 1, z: 0 } },
      offset: { x: 2, y: 0, z: 0 },
    }));
    expect(moved).toMatchObject({ success: true, revision: 2 });

    const view = payload(handlers.render_build_views({ view: "top" }));
    expect(view).toMatchObject({ appliedView: "top", revision: 2 });
    expect(view.availableViews).toEqual(["iso", "top", "front", "right"]);
    expect(views).toEqual(["top"]);
  });

  it("reports every call to the activity hook", () => {
    const engine = createArenaEngine();
    const calls: [string, boolean][] = [];
    const manualEditLock = createManualEditLock();
    const handlers = createArenaToolHandlers(engine, {
      manualEditLock,
      onToolCall: (name, success) => calls.push([name, success]),
    });

    handlers.get_build_summary({});
    handlers.set_blocks({ expectedRevision: 99, edits: [{ action: "remove", position: { x: 0, y: 1, z: 0 } }] });

    expect(calls).toEqual([
      ["get_build_summary", true],
      ["set_blocks", false],
    ]);
  });

  it("requires the manual edit lock for agent mutations", () => {
    const { engine, handlers } = testHandlers();
    const edit = {
      expectedRevision: 0,
      edits: [{ action: "place", position: { x: 0, y: 1, z: 0 }, block: "stone" }],
    };

    const unlockedWrite = handlers.set_blocks(edit);
    expect(unlockedWrite.isError).toBe(true);
    expect(payload(unlockedWrite)).toMatchObject({
      success: false,
      error: "Lock manual editing before changing the arena",
    });
    expect(engine.getContext().revision).toBe(0);

    expect(payload(handlers.set_manual_edit_lock({ locked: true }))).toMatchObject({
      success: true,
      revision: 0,
      manualEditLock: { locked: true },
    });
    expect(payload(handlers.set_blocks(edit))).toMatchObject({ success: true, revision: 1 });

    handlers.set_manual_edit_lock({ locked: false });
    expect(handlers.undo_build_change({ expectedRevision: 1 }).isError).toBe(true);
    expect(engine.getContext().revision).toBe(1);
  });

  it("lists a short catalog and describes unique tools in requested order", () => {
    const { handlers } = testHandlers();
    const list = payload(handlers.list_tools({}));
    expect(list.loop).toEqual(expect.stringContaining("lock"));
    expect(list.tools).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "generate_shape", when: expect.any(String), ex: expect.any(String) }),
    ]));
    const cards = list.tools as { name: string; when: string }[];
    const whenByName = Object.fromEntries(cards.map((card) => [card.name, card.when]));
    expect(whenByName.get_build_summary).toContain("totals");
    expect(whenByName.query_blocks).toContain("state");
    expect(whenByName.get_build_slices).toContain("dense 2D");
    expect(whenByName.set_blocks).toContain("small precise");
    expect(whenByName.generate_shape).toContain("repeated volumes");
    expect(whenByName.transform_region).toContain("existing region");
    expect(whenByName.render_build_views).toContain("no block data");

    const described = payload(handlers.describe_tools({ names: ["generate_shape", "set_blocks"] }));
    expect(described.tools).toHaveLength(2);
    expect(described.tools).toEqual([
      expect.objectContaining({
        name: "generate_shape",
        when: expect.stringContaining("repeated volumes"),
        inputSchema: ARENA_TOOL_SCHEMAS.generate_shape,
      }),
      expect.objectContaining({
        name: "set_blocks",
        args: expect.stringContaining("expectedRevision"),
        when: expect.stringContaining("small precise"),
        inputSchema: ARENA_TOOL_SCHEMAS.set_blocks,
      }),
    ]);

    expect(handlers.describe_tools({}).isError).toBe(true);
    expect(handlers.describe_tools({ names: ["set_blocks", "set_blocks"] }).isError).toBe(true);
  });
});
