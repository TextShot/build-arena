import { afterEach, describe, expect, it, vi } from "vitest";

import { registerPlaySpaceTools } from "./ai.js";

function modelContextThatFailsOn(failingName) {
  const tools = new Map();
  const registeredNames = [];
  return {
    tools,
    registeredNames,
    async registerTool(tool, { signal } = {}) {
      if (tool.name === failingName) throw new Error("registration failed");
      registeredNames.push(tool.name);
      tools.set(tool.name, tool);
      signal?.addEventListener("abort", () => tools.delete(tool.name), { once: true });
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("registerPlaySpaceTools", () => {
  it("keeps tools that registered before a later registration fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const onRegistrationError = vi.fn();
    const modelContext = modelContextThatFailsOn("clear_world");

    expect(await registerPlaySpaceTools({}, { modelContext, onRegistrationError })).toBe(false);
    expect(modelContext.registeredNames).toEqual([
      "get_world_state",
      "run_build_plan",
      "place_blueprint_from_inventory",
    ]);
    expect(modelContext.tools.size).toBe(3);
    expect(onRegistrationError).toHaveBeenCalledWith(expect.any(Error));
    expect(consoleError).toHaveBeenCalledWith("Play Space tool registration failed.", expect.any(Error));
  });

  it("reports rejected inventory blocks instead of counting them as applied", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify({
        version: 1,
        entries: [{ id: "mixed", blocks: [
          { x: 0, y: 1, z: 0, block: "stone" },
          { x: 1, y: 1, z: 0, block: "glass" },
        ] }],
      }),
    });
    const modelContext = modelContextThatFailsOn(null);
    const world = {
      radius: 10,
      place: (_x, _y, _z, block) => block !== "glass",
    };
    expect(await registerPlaySpaceTools(world, { modelContext })).toBe(true);

    const result = modelContext.tools.get("place_blueprint_from_inventory").execute({
      id: "mixed",
      origin: { x: 0, y: 0, z: 0 },
    });
    expect(result).toEqual({ ok: false, applied: 1, skipped: 1 });
  });
});
