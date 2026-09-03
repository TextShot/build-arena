import {
  ARENA_TOOL_NAMES,
  ARENA_TOOL_SCHEMAS,
  READ_ONLY_TOOLS,
  type ArenaToolName,
} from "./tool-schemas";
import type { ToolDescriptor } from "./webmcp-types";

export type HostToolDescriptor = Omit<ToolDescriptor, "execute" | "name"> & Readonly<{
  name: ArenaToolName;
}>;

export const HOST_INPUT_STUB = Object.freeze({
  type: "object",
  description: "Args: describe_tools({names}); full schema: detail=\"schema\".",
  additionalProperties: true,
  properties: Object.freeze({}),
} as const);

const DISCOVERY_TOOLS: readonly ArenaToolName[] = Object.freeze([
  "list_tools",
  "describe_tools",
]);

function describeTool(name: ArenaToolName): string {
  const schema = ARENA_TOOL_SCHEMAS[name] as { description?: string };
  const description = schema.description ?? name;
  return DISCOVERY_TOOLS.includes(name)
    ? description
    : `${description} First call describe_tools({names:["${name}"],detail:"compact"}).`;
}

export function buildHostToolDescriptors(
): readonly HostToolDescriptor[] {
  return ARENA_TOOL_NAMES.map((name) => Object.freeze({
    name,
    description: describeTool(name),
    inputSchema: DISCOVERY_TOOLS.includes(name)
      ? ARENA_TOOL_SCHEMAS[name] as unknown as Record<string, unknown>
      : HOST_INPUT_STUB,
    annotations: { readOnlyHint: READ_ONLY_TOOLS.includes(name) },
  }));
}

export function measureHostCatalogBytes(
  descriptors: readonly HostToolDescriptor[],
): number {
  return new TextEncoder().encode(JSON.stringify(descriptors)).byteLength;
}
