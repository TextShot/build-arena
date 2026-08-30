import { MAX_BUILD_HEIGHT, MAX_PLATFORM_SIZE } from "../core/arena-config";
import { ALL_BLOCK_IDS, FACINGS } from "../core/block-types";

const MAX_RADIUS = (MAX_PLATFORM_SIZE - 1) / 2;

const coordinate = {
  type: "object",
  description: "One arena position as integers. X/Z are horizontal, Y is height.",
  additionalProperties: false,
  required: ["x", "y", "z"],
  properties: {
    x: { type: "integer", minimum: -MAX_RADIUS, maximum: MAX_RADIUS, description: "East/west position." },
    y: { type: "integer", minimum: 0, maximum: MAX_BUILD_HEIGHT, description: "Height. The platform at y=0 is protected." },
    z: { type: "integer", minimum: -MAX_RADIUS, maximum: MAX_RADIUS, description: "North/south position." },
  },
} as const;

const offsetCoordinate = {
  type: "object",
  description: "A relative offset applied to every block position in the region.",
  additionalProperties: false,
  required: ["x", "y", "z"],
  properties: {
    x: { type: "integer", minimum: -MAX_PLATFORM_SIZE, maximum: MAX_PLATFORM_SIZE, description: "X offset." },
    y: { type: "integer", minimum: -MAX_BUILD_HEIGHT, maximum: MAX_BUILD_HEIGHT, description: "Y offset." },
    z: { type: "integer", minimum: -MAX_PLATFORM_SIZE, maximum: MAX_PLATFORM_SIZE, description: "Z offset." },
  },
} as const;

const bounds = {
  type: "object",
  description: "Inclusive min/max corners of a region inside the current arena bounds.",
  additionalProperties: false,
  required: ["min", "max"],
  properties: { min: coordinate, max: coordinate },
} as const;

const blockId = {
  type: "string",
  enum: ALL_BLOCK_IDS,
  description: "Block type id. get_arena_context lists the supported ids.",
} as const;

const blockState = {
  type: "object",
  description: "Block state. Required for oak_slab {half}, oak_stairs {facing, half}, oak_trapdoor {facing, half, open}; other blocks take no state.",
  additionalProperties: false,
  properties: {
    facing: { type: "string", enum: FACINGS, description: "Horizontal direction the block faces." },
    half: { type: "string", enum: ["top", "bottom"], description: "Vertical half of the cell." },
    open: { type: "boolean", description: "Trapdoor open flag." },
    shape: { const: "straight", description: "Stair shape; only straight is supported." },
  },
} as const;

const objectId = {
  type: "string",
  minLength: 1,
  maxLength: 64,
  pattern: "^[a-zA-Z0-9][a-zA-Z0-9_-]*$",
  description: "Persistent object-group id shown in the Layers panel. Reuse appends only when the block type matches.",
} as const;

const expectedRevision = {
  type: "integer",
  minimum: 0,
  description: "The revision observed by your latest read. Stale values are rejected without changing anything.",
} as const;

const dryRun = {
  type: "boolean",
  description: "When true, validate and report affected blocks/bounds without mutating the arena.",
} as const;

const pattern = {
  type: "string",
  minLength: 1,
  maxLength: 120,
  description: "Compact run-string block_objectId@x,y,z+(axisCount); count includes the origin block.",
} as const;

const shapeKind = {
  type: "string",
  enum: ["floor", "wall", "filled_box", "hollow_box"],
  description: "Shape kind for a structured call.",
} as const;

export const ARENA_TOOL_SCHEMAS = Object.freeze({
  get_arena_context: {
    type: "object",
    description: "Read the coordinate convention, current bounds, revision, block types, and operation limits.",
    additionalProperties: false,
    properties: {},
  },
  get_build_summary: {
    type: "object",
    description: "Read the current revision, block count, per-material counts, occupied bounds, and object groups.",
    additionalProperties: false,
    properties: {},
  },
  query_blocks: {
    type: "object",
    description: "Query build blocks with optional region/layer/type filters. Results are paginated and deterministic.",
    additionalProperties: false,
    properties: {
      region: bounds,
      layerY: { type: "integer", minimum: 0, maximum: MAX_BUILD_HEIGHT, description: "Restrict results to one Y layer." },
      blockType: blockId,
      limit: { type: "integer", minimum: 1, maximum: 500, description: "Page size, 1-500. Default 200." },
      offset: { type: "integer", minimum: 0, description: "Page offset. Restart at 0 after the revision changes." },
    },
  },
  get_build_slices: {
    type: "object",
    description: "Read one exact 2D slice with a fixed axis. More reliable than images for exact coordinates.",
    additionalProperties: false,
    required: ["axis", "index"],
    properties: {
      axis: { type: "string", enum: ["x", "y", "z"], description: "The fixed axis of the slice." },
      index: { type: "integer", minimum: -MAX_RADIUS, maximum: MAX_BUILD_HEIGHT, description: "The fixed coordinate on that axis." },
    },
  },
  set_manual_edit_lock: {
    type: "object",
    description: "Lock human arena writes before agent mutations, then unlock when finished. Reads do not require the lock. The lock expires five minutes after the last agent tool call.",
    additionalProperties: false,
    required: ["locked"],
    properties: {
      locked: {
        type: "boolean",
        description: "True before set_blocks, undo_build_change, generate_shape, or transform_region; false when finished. get_arena_context, queries, slices, and render_build_views work unlocked.",
      },
    },
  },
  set_blocks: {
    type: "object",
    description: "Apply up to 256 exact edits atomically: place on empty cells, replace occupied cells, remove blocks.",
    additionalProperties: false,
    required: ["expectedRevision", "edits"],
    properties: {
      expectedRevision,
      edits: {
        type: "array",
        minItems: 1,
        maxItems: 256,
        description: "Exact edits. Duplicate coordinates reject the whole batch.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["action", "position"],
          properties: {
            action: { type: "string", enum: ["place", "replace", "remove"], description: "place requires an empty cell; replace requires an occupied cell." },
            position: coordinate,
            block: blockId,
            state: blockState,
            objectId,
          },
        },
      },
    },
  },
  undo_build_change: {
    type: "object",
    description: "Undo the most recent eligible change. Returns the resulting revision and affected bounds.",
    additionalProperties: false,
    required: ["expectedRevision"],
    properties: {
      expectedRevision,
      undoId: { type: "string", minLength: 1, maxLength: 100, description: "Optional guard: only undo when this is still the latest eligible entry." },
    },
  },
  save_blueprint: {
    type: "object",
    description: "Validate and return the current build as a canonical schemaVersion 2 blueprint. Downloading stays a human UI action.",
    additionalProperties: false,
    properties: {
      id: { type: "string", minLength: 1, maxLength: 100, description: "Blueprint id. Defaults to arena-build." },
      name: { type: "string", minLength: 1, maxLength: 100, description: "Blueprint display name. Defaults to Arena Build." },
    },
  },
  generate_shape: {
    type: "object",
    description: "Fill a floor, wall, filled box, or hollow box atomically. Accepts either structured fields or a compact pattern run-string like oak_planks_1@0,1,0-(x5).",
    oneOf: [
      {
        title: "pattern",
        description: "Generate one straight run from the compact pattern DSL.",
        type: "object",
        additionalProperties: false,
        required: ["expectedRevision", "pattern"],
        properties: { expectedRevision, pattern, dryRun },
      },
      {
        title: "structured",
        description: "Generate a floor, wall, filled box, or hollow box from explicit fields.",
        type: "object",
        additionalProperties: false,
        required: ["expectedRevision", "shape", "region", "block"],
        properties: {
          expectedRevision,
          shape: shapeKind,
          region: bounds,
          block: blockId,
          state: blockState,
          objectId,
          dryRun,
        },
      },
    ],
  },
  transform_region: {
    type: "object",
    description: "Copy, move, rotate, mirror, or replace block types inside a region atomically. Grouping and state are preserved and reoriented.",
    oneOf: [
      {
        title: "copy",
        description: "Copy every block in the region by an offset.",
        type: "object",
        additionalProperties: false,
        required: ["expectedRevision", "operation", "region", "offset"],
        properties: {
          expectedRevision,
          operation: { type: "string", enum: ["copy"], description: "Copy the region." },
          region: bounds,
          offset: offsetCoordinate,
          dryRun,
        },
      },
      {
        title: "move",
        description: "Move every block in the region by an offset.",
        type: "object",
        additionalProperties: false,
        required: ["expectedRevision", "operation", "region", "offset"],
        properties: {
          expectedRevision,
          operation: { type: "string", enum: ["move"], description: "Move the region." },
          region: bounds,
          offset: offsetCoordinate,
          dryRun,
        },
      },
      {
        title: "rotate",
        description: "Rotate the region clockwise around Y.",
        type: "object",
        additionalProperties: false,
        required: ["expectedRevision", "operation", "region", "rotation"],
        properties: {
          expectedRevision,
          operation: { type: "string", enum: ["rotate"], description: "Rotate the region." },
          region: bounds,
          rotation: { type: "integer", enum: [90, 180, 270], description: "Clockwise degrees around Y." },
          dryRun,
        },
      },
      {
        title: "mirror",
        description: "Mirror the region across X or Z.",
        type: "object",
        additionalProperties: false,
        required: ["expectedRevision", "operation", "region", "axis"],
        properties: {
          expectedRevision,
          operation: { type: "string", enum: ["mirror"], description: "Mirror the region." },
          region: bounds,
          axis: { type: "string", enum: ["x", "z"], description: "Axis to mirror across." },
          dryRun,
        },
      },
      {
        title: "replace_type",
        description: "Replace one block type with another inside the region.",
        type: "object",
        additionalProperties: false,
        required: ["expectedRevision", "operation", "region", "from", "to"],
        properties: {
          expectedRevision,
          operation: { type: "string", enum: ["replace_type"], description: "Replace matching block types." },
          region: bounds,
          from: blockId,
          to: blockId,
          dryRun,
        },
      },
    ],
  },
  render_build_views: {
    type: "object",
    description: "Switch the visible diagnostic camera view and return view metadata. Structured queries remain the source of truth; no images are returned.",
    additionalProperties: false,
    properties: {
      view: { type: "string", enum: ["iso", "top", "front", "right"], description: "Camera preset to show in the visible viewport." },
    },
  },
} as const);

export type ArenaToolName = keyof typeof ARENA_TOOL_SCHEMAS;

export const ARENA_TOOL_NAMES = Object.freeze(
  Object.keys(ARENA_TOOL_SCHEMAS) as ArenaToolName[],
);

export const ARENA_MUTATION_TOOLS: readonly ArenaToolName[] = Object.freeze([
  "set_blocks",
  "undo_build_change",
  "generate_shape",
  "transform_region",
]);

export const READ_ONLY_TOOLS: readonly ArenaToolName[] = Object.freeze([
  "get_arena_context",
  "get_build_summary",
  "query_blocks",
  "get_build_slices",
  "render_build_views",
]);
