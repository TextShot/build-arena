import { describe, expect, it } from "vitest";

import { PHASE_1_MAX_BYTES } from "./host-catalog-budget";
import { buildHostToolDescriptors, measureHostCatalogBytes } from "./host-catalog-payload";
import { ARENA_TOOL_NAMES, ARENA_TOOL_SCHEMAS } from "./tool-schemas";

describe("WebMCP host catalog payload", () => {
  it("keeps discovery schemas real and holds back all other argument schemas", () => {
    const descriptors = buildHostToolDescriptors();
    const byName = new Map(descriptors.map((descriptor) => [descriptor.name, descriptor]));

    expect(descriptors.map((descriptor) => descriptor.name)).toEqual(ARENA_TOOL_NAMES);
    expect(byName.get("list_tools")?.inputSchema).toBe(ARENA_TOOL_SCHEMAS.list_tools);
    expect(byName.get("describe_tools")?.inputSchema).toBe(ARENA_TOOL_SCHEMAS.describe_tools);
    expect(byName.get("set_blocks")?.description).toContain(
      'First call describe_tools({names:["set_blocks"]}).',
    );
    expect(byName.get("set_blocks")?.inputSchema).toEqual({
      type: "object",
      description: "Full args: describe_tools({names}).",
      additionalProperties: true,
      properties: {},
    });
    expect(measureHostCatalogBytes(descriptors)).toBeLessThanOrEqual(PHASE_1_MAX_BYTES);
  });
});
