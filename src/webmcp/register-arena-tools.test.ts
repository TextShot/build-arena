import { describe, expect, it } from "vitest";

import { createArenaEngine } from "../core/arena-world";
import { createManualEditLock } from "./manual-edit-lock";
import { registerArenaTools } from "./register-arena-tools";
import { ARENA_TOOL_NAMES } from "./tool-schemas";
import type { ModelContext, ToolDescriptor } from "./webmcp-types";

/** Mimics the draft spec: registrations live until the provided signal aborts. */
function fakeModelContext() {
  const tools = new Map<string, ToolDescriptor>();
  const modelContext: ModelContext = {
    async registerTool(tool, options) {
      tools.set(tool.name, tool);
      options?.signal?.addEventListener("abort", () => tools.delete(tool.name), { once: true });
    },
  };
  return { modelContext, tools };
}

describe("registerArenaTools", () => {
  it("is harmless when document.modelContext is missing", async () => {
    const engine = createArenaEngine();
    const controller = new AbortController();

    expect(await registerArenaTools(engine, { signal: controller.signal })).toBe(false);
    expect(() => controller.abort()).not.toThrow();
  });

  it("registers every frozen tool with read-only annotations and working handlers", async () => {
    const engine = createArenaEngine();
    const { modelContext, tools } = fakeModelContext();
    const controller = new AbortController();

    expect(await registerArenaTools(engine, {
      signal: controller.signal,
      modelContext,
      hooks: { manualEditLock: createManualEditLock() },
    })).toBe(true);
    expect([...tools.keys()].sort()).toEqual([...ARENA_TOOL_NAMES].sort());
    expect(tools.get("get_arena_context")?.annotations?.readOnlyHint).toBe(true);
    expect(tools.get("list_tools")?.annotations?.readOnlyHint).toBe(true);
    expect(tools.get("describe_tools")?.annotations?.readOnlyHint).toBe(true);
    expect(tools.get("set_manual_edit_lock")?.annotations?.readOnlyHint).toBe(false);
    expect(tools.get("set_blocks")?.annotations?.readOnlyHint).toBe(false);

    await tools.get("set_manual_edit_lock")?.execute({ locked: true });
    const write = await tools.get("set_blocks")?.execute({
      expectedRevision: 0,
      edits: [{ action: "place", position: { x: 0, y: 1, z: 0 }, block: "stone" }],
    });
    expect(JSON.parse(write?.content[0]?.text ?? "{}")).toMatchObject({ success: true, revision: 1 });
    expect(engine.getSummary().blockCount).toBe(1);
  });

  it("does not expose any resize tool to agents", async () => {
    const { modelContext, tools } = fakeModelContext();
    const controller = new AbortController();
    await registerArenaTools(createArenaEngine(), { signal: controller.signal, modelContext });

    expect([...tools.keys()].some((name) => name.includes("resize"))).toBe(false);
  });

  it("removes registrations when the AbortController aborts", async () => {
    const engine = createArenaEngine();
    const { modelContext, tools } = fakeModelContext();
    const controller = new AbortController();
    await registerArenaTools(engine, { signal: controller.signal, modelContext });
    expect(tools.size).toBe(ARENA_TOOL_NAMES.length);

    controller.abort();
    expect(tools.size).toBe(0);
  });

  it("refuses to register on an already-aborted signal", async () => {
    const engine = createArenaEngine();
    const { modelContext, tools } = fakeModelContext();
    const controller = new AbortController();
    controller.abort();

    expect(await registerArenaTools(engine, { signal: controller.signal, modelContext })).toBe(false);
    expect(tools.size).toBe(0);
  });

  it("returns false when registerTool rejects", async () => {
    const modelContext: ModelContext = {
      registerTool() {
        return Promise.reject(new Error("NotAllowedError"));
      },
    };
    const controller = new AbortController();

    expect(await registerArenaTools(createArenaEngine(), {
      signal: controller.signal,
      modelContext,
    })).toBe(false);
  });
});
