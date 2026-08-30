import Ajv, { type ValidateFunction } from "ajv";

import type { ArenaEngine, GenerateShapeCommand } from "../core/arena-engine";
import { createBlueprint } from "../core/blueprint";
import { collectObjectGroups } from "../core/arena-queries";
import { parsePatternDsl } from "../core/pattern-dsl";
import { ARENA_TOOL_SCHEMAS, type ArenaToolName } from "./tool-schemas";
import { arenaResultToolResult, errorToolResult, jsonToolResult } from "./tool-results";
import type { ToolCallResult } from "./webmcp-types";

export type ArenaToolHooks = Readonly<{
  /** Called after every tool call so the UI can show agent activity. */
  onToolCall?: (name: ArenaToolName, success: boolean, revision: number, payload: string) => void;
  /** Called when render_build_views asks the visible viewport to change. */
  onRenderView?: (view: "iso" | "top" | "front" | "right") => void;
}>;

export type ArenaToolHandler = (args: unknown) => ToolCallResult;

const ajv = new Ajv({ allErrors: true, strict: true });
const validators = new Map<ArenaToolName, ValidateFunction>();
for (const [name, schema] of Object.entries(ARENA_TOOL_SCHEMAS)) {
  validators.set(name as ArenaToolName, ajv.compile(schema));
}

function schemaError(name: ArenaToolName, validate: ValidateFunction): ToolCallResult {
  const issue = validate.errors?.[0];
  const fieldPath = issue?.instancePath?.replace(/^\//, "").replaceAll("/", ".") || "arguments";
  return errorToolResult(issue?.message ? `${name} ${issue.message}` : `${name} arguments are invalid`, fieldPath);
}

/**
 * Thin handlers: validate arguments against the frozen schema, read fresh
 * engine state, call the engine exactly once for writes, and shape the result.
 * No Three.js or UI-store mutation happens here.
 */
export function createArenaToolHandlers(
  engine: ArenaEngine,
  hooks: ArenaToolHooks = {},
): Record<ArenaToolName, ArenaToolHandler> {
  const run = (name: ArenaToolName, handler: (args: Record<string, unknown>) => ToolCallResult): ArenaToolHandler =>
    (args: unknown): ToolCallResult => {
      const validate = validators.get(name);
      if (validate && !validate(args ?? {})) {
        const result = schemaError(name, validate);
        hooks.onToolCall?.(name, false, engine.getContext().revision, result.content[0]?.text ?? "{}");
        return result;
      }
      let result: ToolCallResult;
      try {
        result = handler((args ?? {}) as Record<string, unknown>);
      } catch (error) {
        result = errorToolResult(error instanceof Error ? error.message : "Tool call failed");
      }
      hooks.onToolCall?.(name, !result.isError, engine.getContext().revision, result.content[0]?.text ?? "{}");
      return result;
    };

  return {
    get_arena_context: run("get_arena_context", () => {
      const context = engine.getContext();
      return jsonToolResult({
        coordinateConvention: "(x, y, z); X/Z horizontal, Y is height; the platform at y=0 is protected and implicit",
        bounds: context.bounds,
        revision: context.revision,
        blockTypes: context.blockTypes,
        blockStates: {
          oak_slab: ["half"],
          oak_stairs: ["facing", "half", "shape"],
          oak_trapdoor: ["facing", "half", "open"],
        },
        limits: context.limits,
        sizeControl: "Arena platform/height sizing is human-only via the UI sliders; agents read bounds but cannot resize",
      });
    }),

    get_build_summary: run("get_build_summary", () => {
      const summary = engine.getSummary();
      return jsonToolResult({
        ...summary,
        objectGroups: collectObjectGroups(engine.snapshotBlocks()),
      });
    }),

    query_blocks: run("query_blocks", (args) => jsonToolResult(engine.queryBlocks(args))),

    get_build_slices: run("get_build_slices", (args) =>
      jsonToolResult(engine.getSlice(args as { axis: "x" | "y" | "z"; index: number }))),

    set_blocks: run("set_blocks", (args) =>
      arenaResultToolResult(engine.apply({
        type: "set_blocks",
        expectedRevision: args.expectedRevision as number,
        edits: args.edits as never,
      }))),

    undo_build_change: run("undo_build_change", (args) =>
      arenaResultToolResult(engine.apply({
        type: "undo",
        expectedRevision: args.expectedRevision as number,
        ...(args.undoId !== undefined ? { undoId: args.undoId as string } : {}),
      }))),

    save_blueprint: run("save_blueprint", (args) => {
      const blueprint = createBlueprint(engine.snapshotBlocks(), {
        id: (args.id as string | undefined) ?? "arena-build",
        name: (args.name as string | undefined) ?? "Arena Build",
      });
      return jsonToolResult({ revision: engine.getContext().revision, blueprint });
    }),

    generate_shape: run("generate_shape", (args) => {
      const expectedRevision = args.expectedRevision as number;
      const dryRun = args.dryRun as boolean | undefined;
      if (typeof args.pattern === "string") {
        if (args.shape !== undefined || args.region !== undefined || args.block !== undefined) {
          return errorToolResult("Provide either pattern or shape/region/block, not both", "pattern");
        }
        const parsed = parsePatternDsl(args.pattern, engine.getContext().bounds);
        if (!parsed.success) return errorToolResult(parsed.error, parsed.fieldPath);
        return arenaResultToolResult(engine.apply({
          ...parsed.command,
          expectedRevision,
          ...(dryRun !== undefined ? { dryRun } : {}),
        }));
      }
      if (args.shape === undefined || args.region === undefined || args.block === undefined) {
        return errorToolResult("shape, region, and block are required unless a pattern is provided", "shape");
      }
      return arenaResultToolResult(engine.apply({
        type: "generate_shape",
        expectedRevision,
        shape: args.shape,
        region: args.region,
        block: args.block,
        state: args.state,
        objectId: args.objectId,
        dryRun,
      } as GenerateShapeCommand));
    }),

    transform_region: run("transform_region", (args) =>
      arenaResultToolResult(engine.apply({
        type: "transform_region",
        expectedRevision: args.expectedRevision,
        operation: args.operation,
        region: args.region,
        offset: args.offset,
        rotation: args.rotation,
        axis: args.axis,
        from: args.from,
        to: args.to,
        dryRun: args.dryRun,
      } as never))),

    render_build_views: run("render_build_views", (args) => {
      const view = (args.view as "iso" | "top" | "front" | "right" | undefined) ?? "iso";
      hooks.onRenderView?.(view);
      return jsonToolResult({
        revision: engine.getContext().revision,
        appliedView: view,
        availableViews: ["iso", "top", "front", "right"],
        note: "The visible viewport now shows this preset. Use query_blocks or get_build_slices for exact coordinates; images are not returned.",
      });
    }),
  };
}
