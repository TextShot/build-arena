/** Short cards for list_tools. Keep strings tiny — this payload is meant to be cheap. */
export const LIST_TOOL_CARDS = Object.freeze([
  Object.freeze({ name: "list_tools", when: "start here: choose tools + tiny examples", ex: "{}" }),
  Object.freeze({ name: "describe_tools", when: "before stubbed calls: compact args or full schemas", ex: "{names:[\"set_blocks\",\"generate_shape\"],detail:\"compact\"}" }),
  Object.freeze({ name: "get_arena_context", when: "first read: bounds, revision, block ids, limits, lock", ex: "{}" }),
  Object.freeze({ name: "get_build_summary", when: "planning/final totals + bounds; groups optional", ex: "{}" }),
  Object.freeze({ name: "query_blocks", when: "exact coordinates, state, objectId; sparse/paginated checks", ex: "{layerY:1,limit:50}" }),
  Object.freeze({ name: "get_build_slices", when: "dense 2D plane for layer or side pattern checks", ex: "{axis:\"y\",index:1}" }),
  Object.freeze({ name: "set_manual_edit_lock", when: "required before mutations; release after success or failure", ex: "{locked:true}" }),
  Object.freeze({ name: "generate_shape", when: "repeated volumes or runs: floors, walls, filled/hollow boxes", ex: "{expectedRevision:0,pattern:\"oak_planks_1@0,1,0-(x5)\"}" }),
  Object.freeze({ name: "transform_region", when: "edit an existing region: copy, move, rotate, mirror, replace type", ex: "{expectedRevision:0,operation:\"move\",region:{min:{x:0,y:1,z:0},max:{x:0,y:1,z:0}},offset:{x:2,y:0,z:0}}" }),
  Object.freeze({ name: "set_blocks", when: "small precise place/replace/remove edits (≤256)", ex: "{expectedRevision:0,edits:[{action:\"place\",position:{x:0,y:1,z:0},block:\"stone\"}]}" }),
  Object.freeze({ name: "undo_build_change", when: "revert the latest eligible mutation after a mistake", ex: "{expectedRevision:1}" }),
  Object.freeze({ name: "render_build_views", when: "human camera only; no block data or image result", ex: "{view:\"top\"}" }),
]);

export const LIST_TOOLS_LOOP =
  "lock → context → summary → query/slice → chain successful writes using returned revision → final summary → unlock; after an error re-read state";

type ListCard = (typeof LIST_TOOL_CARDS)[number];

const DETAILED_BY_NAME: Readonly<Record<ListCard["name"], Readonly<{
  args: string;
  example: string;
  when: string;
}>>> = Object.freeze({
  list_tools: {
    args: "{}",
    example: "{}",
    when: "Use first to choose the smallest useful tool set. Returns compact names, decision guidance, and tiny examples; call describe_tools with detail:\"schema\" for full schemas.",
  },
  describe_tools: {
    args: "{names[1..10 unique],detail?:compact|schema}",
    example: "{names:[\"generate_shape\",\"set_blocks\"],detail:\"compact\"}",
    when: "Use before selected stubbed tools. compact returns args/examples; schema also returns full schemas for complex or failed calls.",
  },
  get_arena_context: {
    args: "{}",
    example: "{}",
    when: "Use at the start of arena work to learn playable bounds, current revision, supported block/state types, limits, and lock status. Choose get_build_summary for build totals.",
  },
  get_build_summary: {
    args: "{includeObjectGroups?}",
    example: "{}",
    when: "Use before planning, at the end, or after an error for revision, material totals, and occupied bounds. counts includes only present materials; absent means zero. Object groups are omitted unless includeObjectGroups=true. Choose query_blocks for exact coordinates.",
  },
  query_blocks: {
    args: "{region?,layerY?,blockType?,limit?,offset?}",
    example: "{layerY:1,limit:50}",
    when: "Use for exact block coordinates, state, and objectId, including filtered or paginated verification. Choose get_build_slices for a dense 2D plane.",
  },
  get_build_slices: {
    args: "{axis,index}",
    example: "{axis:\"y\",index:1}",
    when: "Use for one dense 2D X/Z, X/Y, or Z/Y plane when checking layers, symmetry, or patterns. Choose query_blocks for sparse cells with full state.",
  },
  set_manual_edit_lock: {
    args: "{locked}",
    example: "{locked:true}",
    when: "Use locked=true immediately before agent mutations and locked=false in final cleanup after success or failure. Reads remain available while unlocked; the lock expires after inactivity.",
  },
  generate_shape: {
    args: "{expectedRevision,pattern} or {expectedRevision,shape,region,block,state?,objectId?,dryRun?}",
    example: "{expectedRevision:0,pattern:\"oak_planks_1@0,1,0-(x5)\"}",
    when: "Use for repeated volumes or straight runs: floors, walls, and filled/hollow boxes. Prefer this over set_blocks when many cells follow one geometric pattern.",
  },
  transform_region: {
    args: "{expectedRevision,operation,region,...op fields,dryRun?}",
    example: "{expectedRevision:0,operation:\"copy\",region:{min:{x:0,y:1,z:0},max:{x:2,y:1,z:2}},offset:{x:4,y:0,z:0}}",
    when: "Use to modify an existing region atomically by copy, move, rotation, mirror, or block-type replacement. It preserves block state and grouping; prefer it over rebuilding the region.",
  },
  set_blocks: {
    args: "{expectedRevision,edits[1..256]}",
    example: "{expectedRevision:0,edits:[{action:\"place\",position:{x:0,y:1,z:0},block:\"stone\"}]}",
    when: "Use for small precise batches of up to 256 place, replace, or remove edits at explicit coordinates. Choose generate_shape for repeated geometry and transform_region for existing regions.",
  },
  undo_build_change: {
    args: "{expectedRevision,undoId?}",
    example: "{expectedRevision:1}",
    when: "Use after an incorrect latest eligible arena mutation. Pass the current expectedRevision; include undoId when you need to ensure the same change is still latest.",
  },
  render_build_views: {
    args: "{view?}",
    example: "{view:\"top\"}",
    when: "Use only to move the human-visible camera to iso, top, front, or right. It returns view metadata, not block data or an image; use query_blocks or slices for exact structure.",
  },
});

export function listToolsPayload(): Readonly<{ loop: string; tools: typeof LIST_TOOL_CARDS }> {
  return Object.freeze({ loop: LIST_TOOLS_LOOP, tools: LIST_TOOL_CARDS });
}

export function describeToolsPayload(
  names: readonly ListCard["name"][],
  inputSchemas: Readonly<Record<ListCard["name"], object>>,
  detail: "compact" | "schema" = "schema",
): Readonly<{ tools: readonly object[] }> {
  return Object.freeze({
    tools: Object.freeze(names.map((name) => {
      const tool = DETAILED_BY_NAME[name];
      const compact = { name, args: tool.args, example: tool.example };
      return Object.freeze(detail === "schema"
        ? { ...compact, when: tool.when, inputSchema: inputSchemas[name] }
        : compact);
    })),
  });
}

export const DESCRIBE_TOOLS_NAME_ENUM = LIST_TOOL_CARDS.map((card) => card.name);
