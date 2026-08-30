/** Short cards for list_tools. Keep strings tiny — this payload is meant to be cheap. */
export const LIST_TOOL_CARDS = Object.freeze([
  Object.freeze({ name: "list_tools", when: "this catalog", ex: "{}" }),
  Object.freeze({ name: "describe_tools", when: "args + examples", ex: "{name:\"set_blocks\"}" }),
  Object.freeze({ name: "get_arena_context", when: "bounds, revision, block ids", ex: "{}" }),
  Object.freeze({ name: "get_build_summary", when: "counts + occupied box", ex: "{}" }),
  Object.freeze({ name: "query_blocks", when: "exact cells", ex: "{layerY:1,limit:50}" }),
  Object.freeze({ name: "get_build_slices", when: "one 2D layer", ex: "{axis:\"y\",index:1}" }),
  Object.freeze({ name: "set_manual_edit_lock", when: "before/after writes", ex: "{locked:true}" }),
  Object.freeze({ name: "generate_shape", when: "floor/wall/box/run", ex: "{expectedRevision:0,pattern:\"oak_planks_1@0,1,0-(x5)\"}" }),
  Object.freeze({ name: "transform_region", when: "copy/move/rotate/mirror/replace", ex: "{expectedRevision:0,operation:\"move\",region:{min:{x:0,y:1,z:0},max:{x:0,y:1,z:0}},offset:{x:2,y:0,z:0}}" }),
  Object.freeze({ name: "set_blocks", when: "≤256 exact edits", ex: "{expectedRevision:0,edits:[{action:\"place\",position:{x:0,y:1,z:0},block:\"stone\"}]}" }),
  Object.freeze({ name: "undo_build_change", when: "undo last write", ex: "{expectedRevision:1}" }),
  Object.freeze({ name: "save_blueprint", when: "canonical JSON snapshot", ex: "{name:\"House\"}" }),
  Object.freeze({ name: "render_build_views", when: "human camera only", ex: "{view:\"top\"}" }),
]);

export const LIST_TOOLS_LOOP =
  "lock → context → summary → query/slice → one write → re-read → unlock";

type ListCard = (typeof LIST_TOOL_CARDS)[number];

const DETAILED_BY_NAME: Readonly<Record<ListCard["name"], Readonly<{
  args: string;
  example: string;
  when: string;
}>>> = Object.freeze({
  list_tools: {
    args: "{}",
    example: "{}",
    when: "Start here. Cheap names/when/ex. Use describe_tools for one tool's args.",
  },
  describe_tools: {
    args: "{name?}",
    example: "{name:\"generate_shape\"}",
    when: "Need arguments or a fuller example. Omit name for every tool (larger).",
  },
  get_arena_context: {
    args: "{}",
    example: "{}",
    when: "Need bounds, revision, blockTypes, lock, limits. Not a block list.",
  },
  get_build_summary: {
    args: "{}",
    example: "{}",
    when: "After context or a write. Counts, occupiedBounds, objectGroups, revision.",
  },
  query_blocks: {
    args: "{region?,layerY?,blockType?,limit?,offset?}",
    example: "{layerY:1,limit:50}",
    when: "Need exact coordinates. Viewport is visual only.",
  },
  get_build_slices: {
    args: "{axis,index}",
    example: "{axis:\"y\",index:1}",
    when: "Need a 2D grid. No images from render_build_views.",
  },
  set_manual_edit_lock: {
    args: "{locked}",
    example: "{locked:true}",
    when: "locked=true before mutations; false when done. Reads work unlocked.",
  },
  generate_shape: {
    args: "{expectedRevision,pattern} or {expectedRevision,shape,region,block,state?,objectId?,dryRun?}",
    example: "{expectedRevision:0,pattern:\"oak_planks_1@0,1,0-(x5)\"}",
    when: "Floors, walls, boxes, or a straight run. Prefer over listing cells.",
  },
  transform_region: {
    args: "{expectedRevision,operation,region,...op fields,dryRun?}",
    example: "{expectedRevision:0,operation:\"copy\",region:{min:{x:0,y:1,z:0},max:{x:2,y:1,z:2}},offset:{x:4,y:0,z:0}}",
    when: "copy/move/rotate/mirror/replace_type. Prefer over rewrite with set_blocks.",
  },
  set_blocks: {
    args: "{expectedRevision,edits[1..256]}",
    example: "{expectedRevision:0,edits:[{action:\"place\",position:{x:0,y:1,z:0},block:\"stone\"}]}",
    when: "Few exact place/replace/remove edits. Shapes for volumes.",
  },
  undo_build_change: {
    args: "{expectedRevision,undoId?}",
    example: "{expectedRevision:1}",
    when: "Undo the latest eligible write.",
  },
  save_blueprint: {
    args: "{id?,name?}",
    example: "{name:\"House\"}",
    when: "Canonical schemaVersion 2 JSON. Download stays human UI.",
  },
  render_build_views: {
    args: "{view?}",
    example: "{view:\"top\"}",
    when: "Move the human camera. Coordinates still from query/slice.",
  },
});

export function listToolsPayload(): Readonly<{ loop: string; tools: typeof LIST_TOOL_CARDS }> {
  return Object.freeze({ loop: LIST_TOOLS_LOOP, tools: LIST_TOOL_CARDS });
}

export function describeToolsPayload(name?: string): Readonly<{ tools: readonly object[] }> {
  const names = name ? [name as ListCard["name"]] : LIST_TOOL_CARDS.map((card) => card.name);
  return Object.freeze({
    tools: Object.freeze(names.map((toolName) => {
      const detail = DETAILED_BY_NAME[toolName];
      return Object.freeze({ name: toolName, ...detail });
    })),
  });
}

export const DESCRIBE_TOOLS_NAME_ENUM = LIST_TOOL_CARDS.map((card) => card.name);
