import { describe, expect, it } from "vitest";

import { createArenaConfig } from "../core/arena-config";
import { createArenaEngine } from "../core/arena-world";
import { createArenaToolHandlers } from "./tool-handlers";
import type { ToolCallResult } from "./webmcp-types";

function payload(result: ToolCallResult): Record<string, unknown> {
  return JSON.parse(result.content[0]?.text ?? "{}") as Record<string, unknown>;
}

describe("arena tool handlers", () => {
  it("reads never mutate the revision", () => {
    const engine = createArenaEngine();
    const handlers = createArenaToolHandlers(engine);

    const context = payload(handlers.get_arena_context({}));
    const summary = payload(handlers.get_build_summary({}));
    handlers.query_blocks({});
    handlers.get_build_slices({ axis: "y", index: 1 });
    handlers.render_build_views({});

    expect(context.revision).toBe(0);
    expect(summary.revision).toBe(0);
    expect(engine.getContext().revision).toBe(0);
  });

  it("rejects schema-invalid arguments with a field path and no mutation", () => {
    const engine = createArenaEngine();
    const handlers = createArenaToolHandlers(engine);

    const result = handlers.set_blocks({
      expectedRevision: 0,
      edits: [{ action: "place", position: { x: 0, y: 1, z: 0 }, block: "stone" }],
      extra: true,
    });

    expect(result.isError).toBe(true);
    expect(engine.getContext().revision).toBe(0);
  });

  it("applies writes through the shared engine and fails stale writes atomically", () => {
    const engine = createArenaEngine();
    const handlers = createArenaToolHandlers(engine);

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

  it("save_blueprint returns a canonical schemaVersion 2 blueprint", () => {
    const engine = createArenaEngine();
    const handlers = createArenaToolHandlers(engine);
    handlers.set_blocks({
      expectedRevision: 0,
      edits: [{ action: "place", position: { x: 0, y: 1, z: 0 }, block: "obsidian" }],
    });

    const saved = payload(handlers.save_blueprint({ name: "Tower" }));
    expect(saved).toMatchObject({
      revision: 1,
      blueprint: {
        schemaVersion: 2,
        name: "Tower",
        blockSummary: { obsidian: 1 },
      },
    });
  });

  it("generate_shape accepts the compact DSL and groups the result", () => {
    const engine = createArenaEngine(createArenaConfig(11));
    const handlers = createArenaToolHandlers(engine);

    const result = payload(handlers.generate_shape({
      expectedRevision: 0,
      pattern: "oak_planks_1@0,1,0-(x5)",
    }));

    expect(result).toMatchObject({ success: true, affectedBlocks: 5, objectId: "oak_planks_1" });
    const summary = payload(handlers.get_build_summary({}));
    expect(summary.objectGroups).toEqual([{ objectId: "oak_planks_1", block: "oak_planks", count: 5 }]);
  });

  it("generate_shape dryRun reports without mutating", () => {
    const engine = createArenaEngine();
    const handlers = createArenaToolHandlers(engine);

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
    const handlers = createArenaToolHandlers(engine, { onRenderView: (view) => views.push(view) });

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
    const handlers = createArenaToolHandlers(engine, {
      onToolCall: (name, success) => calls.push([name, success]),
    });

    handlers.get_build_summary({});
    handlers.set_blocks({ expectedRevision: 99, edits: [{ action: "remove", position: { x: 0, y: 1, z: 0 } }] });

    expect(calls).toEqual([
      ["get_build_summary", true],
      ["set_blocks", false],
    ]);
  });
});
