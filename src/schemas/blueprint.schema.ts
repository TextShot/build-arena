import { ALL_BLOCK_IDS, FACINGS, PHASE_A_BLOCK_IDS } from "../core/block-types";
import { MAX_BUILD_HEIGHT, MAX_PLATFORM_SIZE } from "../core/arena-config";

const MAX_PLATFORM_RADIUS = (MAX_PLATFORM_SIZE - 1) / 2;

const buildPosition = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y", "z"],
  properties: {
    x: { type: "integer", minimum: -MAX_PLATFORM_RADIUS, maximum: MAX_PLATFORM_RADIUS },
    y: { type: "integer", minimum: 0, maximum: MAX_BUILD_HEIGHT },
    z: { type: "integer", minimum: -MAX_PLATFORM_RADIUS, maximum: MAX_PLATFORM_RADIUS },
  },
} as const;

const sizeShape = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y", "z"],
  properties: {
    x: { type: "integer", minimum: 0, maximum: MAX_PLATFORM_SIZE },
    y: { type: "integer", minimum: 0, maximum: MAX_BUILD_HEIGHT + 1 },
    z: { type: "integer", minimum: 0, maximum: MAX_PLATFORM_SIZE },
  },
} as const;

const anchorShape = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y", "z"],
  properties: { x: { const: 0 }, y: { const: 0 }, z: { const: 0 } },
} as const;

const validationShape = {
  type: "object",
  additionalProperties: false,
  required: ["errors", "warnings"],
  properties: {
    errors: { const: 0 },
    warnings: { type: "array", items: { type: "string" }, maxItems: 100 },
  },
} as const;

const previewShape = {
  type: "object",
  additionalProperties: false,
  required: ["view"],
  properties: { view: { const: "isometric" } },
} as const;

function countsFor(blockIds: readonly string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: [...blockIds],
    properties: Object.fromEntries(blockIds.map((blockId) => [blockId, { type: "integer", minimum: 0 }])),
  } as const;
}

const commonRequired = [
  "schemaVersion",
  "id",
  "name",
  "size",
  "anchor",
  "blocks",
  "blockSummary",
  "validation",
  "preview",
] as const;

export const BLUEPRINT_V1_SCHEMA = {
  $id: "https://build-arena.local/schemas/blueprint-v1.json",
  type: "object",
  additionalProperties: false,
  required: [...commonRequired],
  properties: {
    schemaVersion: { const: 1 },
    id: { type: "string", minLength: 1, maxLength: 100 },
    name: { type: "string", minLength: 1, maxLength: 100 },
    size: sizeShape,
    anchor: anchorShape,
    blocks: {
      type: "array",
      maxItems: MAX_PLATFORM_SIZE * MAX_PLATFORM_SIZE * MAX_BUILD_HEIGHT,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["position", "block"],
        properties: {
          position: buildPosition,
          block: { type: "string", enum: PHASE_A_BLOCK_IDS },
        },
      },
    },
    blockSummary: countsFor(PHASE_A_BLOCK_IDS),
    validation: validationShape,
    preview: previewShape,
  },
} as const;

/**
 * Version 2 blocks may carry a block state (slabs, stairs, trapdoors) and a
 * persistent objectId group. Per-block state validity (which keys each block
 * requires) is domain validation, not schema validation.
 */
export const BLUEPRINT_V2_SCHEMA = {
  $id: "https://build-arena.local/schemas/blueprint-v2.json",
  type: "object",
  additionalProperties: false,
  required: [...commonRequired],
  properties: {
    schemaVersion: { const: 2 },
    id: { type: "string", minLength: 1, maxLength: 100 },
    name: { type: "string", minLength: 1, maxLength: 100 },
    size: sizeShape,
    anchor: anchorShape,
    blocks: {
      type: "array",
      maxItems: MAX_PLATFORM_SIZE * MAX_PLATFORM_SIZE * MAX_BUILD_HEIGHT,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["position", "block"],
        properties: {
          position: buildPosition,
          block: { type: "string", enum: ALL_BLOCK_IDS },
          state: {
            type: "object",
            additionalProperties: false,
            properties: {
              facing: { type: "string", enum: FACINGS },
              half: { type: "string", enum: ["top", "bottom"] },
              open: { type: "boolean" },
              shape: { const: "straight" },
            },
          },
          objectId: { type: "string", minLength: 1, maxLength: 64, pattern: "^[a-zA-Z0-9][a-zA-Z0-9_-]*$" },
        },
      },
    },
    blockSummary: countsFor(ALL_BLOCK_IDS),
    validation: validationShape,
    preview: previewShape,
  },
} as const;
