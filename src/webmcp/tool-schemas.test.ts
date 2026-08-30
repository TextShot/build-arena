import { describe, expect, it } from "vitest";
import Ajv from "ajv";

import { LIST_TOOL_CARDS } from "./tool-catalog";
import { ARENA_MUTATION_TOOLS, ARENA_TOOL_NAMES, ARENA_TOOL_SCHEMAS } from "./tool-schemas";

const ajv = new Ajv({ allErrors: true, strict: true });

describe("arena tool schemas", () => {
  it("compiles every frozen tool schema", () => {
    for (const name of ARENA_TOOL_NAMES) {
      expect(() => ajv.compile(ARENA_TOOL_SCHEMAS[name]), name).not.toThrow();
    }
  });

  it("rejects additional properties on every tool", () => {
    const validArgs: Record<string, object> = {
      list_tools: {},
      describe_tools: { name: "set_blocks" },
      get_arena_context: {},
      get_build_summary: {},
      query_blocks: {},
      get_build_slices: { axis: "y", index: 1 },
      set_manual_edit_lock: { locked: true },
      set_blocks: {
        expectedRevision: 0,
        edits: [{ action: "place", position: { x: 0, y: 1, z: 0 }, block: "stone" }],
      },
      undo_build_change: { expectedRevision: 1 },
      save_blueprint: {},
      generate_shape: {
        expectedRevision: 0,
        pattern: "oak_planks_1@0,1,0-(x5)",
      },
      transform_region: {
        expectedRevision: 0,
        operation: "copy",
        region: { min: { x: 0, y: 1, z: 0 }, max: { x: 0, y: 1, z: 0 } },
        offset: { x: 1, y: 0, z: 0 },
      },
      render_build_views: {},
    };

    for (const name of ARENA_TOOL_NAMES) {
      const validate = ajv.compile(ARENA_TOOL_SCHEMAS[name]);
      expect(validate(validArgs[name]), `${name} valid args`).toBe(true);
      expect(validate({ ...validArgs[name], unexpected: true }), `${name} extra property`).toBe(false);
    }
  });

  it("requires one tool name for describe_tools", () => {
    const validate = ajv.compile(ARENA_TOOL_SCHEMAS.describe_tools);

    expect(validate({})).toBe(false);
    expect(validate({ name: "set_blocks" })).toBe(true);
  });

  it("requires expectedRevision on every arena mutation tool", () => {
    expect(ARENA_MUTATION_TOOLS).toEqual(["set_blocks", "undo_build_change", "generate_shape", "transform_region"]);
    for (const name of ARENA_MUTATION_TOOLS) {
      const schema = ARENA_TOOL_SCHEMAS[name] as {
        required?: readonly string[];
        oneOf?: readonly { required?: readonly string[] }[];
      };
      const variants = schema.oneOf ?? [schema];
      expect(variants.every((variant) => variant.required?.includes("expectedRevision")), name).toBe(true);
    }
  });

  it("caps edit and query batch sizes", () => {
    const setBlocks = ARENA_TOOL_SCHEMAS.set_blocks.properties.edits;
    expect(setBlocks.maxItems).toBe(256);
    expect(ARENA_TOOL_SCHEMAS.query_blocks.properties.limit.maximum).toBe(500);
  });

  it("requires exactly one generate_shape input mode", () => {
    const validate = ajv.compile(ARENA_TOOL_SCHEMAS.generate_shape);
    const region = { min: { x: 0, y: 1, z: 0 }, max: { x: 0, y: 1, z: 0 } };

    expect(validate({ expectedRevision: 0 })).toBe(false);
    expect(validate({ expectedRevision: 0, pattern: "stone_1@0,1,0+(x2)" })).toBe(true);
    expect(validate({ expectedRevision: 0, shape: "floor", region, block: "stone" })).toBe(true);
    expect(validate({ expectedRevision: 0, pattern: "stone_1@0,1,0+(x2)", shape: "floor", region, block: "stone" })).toBe(false);
  });

  it("requires only the fields used by each transform operation", () => {
    const validate = ajv.compile(ARENA_TOOL_SCHEMAS.transform_region);
    const base = {
      expectedRevision: 0,
      region: { min: { x: 0, y: 1, z: 0 }, max: { x: 0, y: 1, z: 0 } },
    };
    const cases = [
      ["copy", { offset: { x: 1, y: 0, z: 0 } }, { rotation: 90 }],
      ["move", { offset: { x: 1, y: 0, z: 0 } }, { axis: "x" }],
      ["rotate", { rotation: 90 }, { offset: { x: 1, y: 0, z: 0 } }],
      ["mirror", { axis: "x" }, { from: "stone" }],
      ["replace_type", { from: "stone", to: "dirt" }, { rotation: 90 }],
    ] as const;

    for (const [operation, required, unrelated] of cases) {
      expect(validate({ ...base, operation }), `${operation} missing fields`).toBe(false);
      expect(validate({ ...base, operation, ...required }), `${operation} valid`).toBe(true);
      expect(validate({ ...base, operation, ...required, ...unrelated }), `${operation} unrelated field`).toBe(false);
    }
  });

  it("keeps list_tools cards in lockstep with registered tool names", () => {
    expect(LIST_TOOL_CARDS.map((card) => card.name).sort()).toEqual([...ARENA_TOOL_NAMES].sort());
  });
});
