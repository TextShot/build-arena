import type { ArenaEngine } from "../core/arena-engine";
import { createArenaToolHandlers, type ArenaToolHooks } from "./tool-handlers";
import { ARENA_TOOL_NAMES, ARENA_TOOL_SCHEMAS, READ_ONLY_TOOLS, type ArenaToolName } from "./tool-schemas";
import type { ModelContext } from "./webmcp-types";

export type RegisterArenaToolsOptions = Readonly<{
  /** Aborting removes every page-scoped registration (WebMCP draft behavior). */
  signal: AbortSignal;
  hooks?: ArenaToolHooks;
  /** Injection point for tests; defaults to the feature-detected document.modelContext. */
  modelContext?: ModelContext;
}>;

function describeTool(name: ArenaToolName): string {
  const schema = ARENA_TOOL_SCHEMAS[name] as { description?: string };
  return schema.description ?? name;
}

/**
 * Registers the Build Arena tools once for the current page context.
 * Feature-detects document.modelContext: unsupported browsers keep the full
 * human editor and this function simply returns false.
 *
 * Tools read fresh engine state on every call, so block/revision changes never
 * require re-registration.
 */
export async function registerArenaTools(
  engine: ArenaEngine,
  options: RegisterArenaToolsOptions,
): Promise<boolean> {
  const modelContext = options.modelContext ??
    (typeof document !== "undefined" ? document.modelContext : undefined);
  if (!modelContext || typeof modelContext.registerTool !== "function" || options.signal.aborted) {
    return false;
  }

  try {
    const handlers = createArenaToolHandlers(engine, options.hooks);
    for (const name of ARENA_TOOL_NAMES) {
      await modelContext.registerTool(
        {
          name,
          description: describeTool(name),
          inputSchema: ARENA_TOOL_SCHEMAS[name] as unknown as Record<string, unknown>,
          annotations: { readOnlyHint: READ_ONLY_TOOLS.includes(name) },
          execute: (args: unknown) => handlers[name](args),
        },
        { signal: options.signal },
      );
    }
    return true;
  } catch {
    return false;
  }
}
