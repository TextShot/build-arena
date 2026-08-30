import { describe, expect, it } from "vitest";
import Ajv from "ajv";

import { ARENA_TOOL_NAMES, ARENA_TOOL_SCHEMAS, READ_ONLY_TOOLS } from "./tool-schemas";

const ajv = new Ajv({ allErrors: true, strict: true });

describe("arena tool schemas", () => {
  it("compiles every frozen tool schema", () => {
    for (const name of ARENA_TOOL_NAMES) {
      expect(() => ajv.compile(ARENA_TOOL_SCHEMAS[name]), name).not.toThrow();
    }
  });

  it("rejects additional properties on every tool", () => {
    const validArgs: Record<string, object> = {
      get_arena_context: {},
      get_build_summary: {},
      query_blocks: {},
      get_build_slices: { axis: "y", index: 1 },
      set_blocks: {
        expectedRevision: 0,
        edits: [{ action: "place", position: { x: 0, y: 1, z: 0 }, block: "stone" }],
      },
      undo_build_change: { expectedRevision: 1 },
      save_blueprint: {},
      generate_shape: { expectedRevision: 0 },
      transform_region: {
        expectedRevision: 0,
        operation: "copy",
        region: { min: { x: 0, y: 1, z: 0 }, max: { x: 0, y: 1, z: 0 } },
      },
      render_build_views: {},
    };

    for (const name of ARENA_TOOL_NAMES) {
      const validate = ajv.compile(ARENA_TOOL_SCHEMAS[name]);
      expect(validate(validArgs[name]), `${name} valid args`).toBe(true);
      expect(validate({ ...validArgs[name], unexpected: true }), `${name} extra property`).toBe(false);
    }
  });

  it("requires expectedRevision on every write tool", () => {
    const writes = ARENA_TOOL_NAMES.filter((name) => !READ_ONLY_TOOLS.includes(name) && name !== "save_blueprint");
    expect(writes).toEqual(["set_blocks", "undo_build_change", "generate_shape", "transform_region"]);
    for (const name of writes) {
      const schema = ARENA_TOOL_SCHEMAS[name] as { required?: readonly string[] };
      expect(schema.required, name).toContain("expectedRevision");
    }
  });

  it("caps edit and query batch sizes", () => {
    const setBlocks = ARENA_TOOL_SCHEMAS.set_blocks.properties.edits;
    expect(setBlocks.maxItems).toBe(256);
    expect(ARENA_TOOL_SCHEMAS.query_blocks.properties.limit.maximum).toBe(500);
  });
});
