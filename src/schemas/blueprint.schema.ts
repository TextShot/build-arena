import { PHASE_A_BLOCK_IDS } from "../core/block-types";
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

const counts = Object.fromEntries(
  PHASE_A_BLOCK_IDS.map((blockId) => [blockId, { type: "integer", minimum: 0 }]),
);

export const BLUEPRINT_V1_SCHEMA = {
  $id: "https://build-arena.local/schemas/blueprint-v1.json",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "id",
    "name",
    "size",
    "anchor",
    "blocks",
    "blockSummary",
    "validation",
    "preview",
  ],
  properties: {
    schemaVersion: { const: 1 },
    id: { type: "string", minLength: 1, maxLength: 100 },
    name: { type: "string", minLength: 1, maxLength: 100 },
    size: {
      type: "object",
      additionalProperties: false,
      required: ["x", "y", "z"],
      properties: {
        x: { type: "integer", minimum: 0, maximum: MAX_PLATFORM_SIZE },
        y: { type: "integer", minimum: 0, maximum: MAX_BUILD_HEIGHT },
        z: { type: "integer", minimum: 0, maximum: MAX_PLATFORM_SIZE },
      },
    },
    anchor: {
      type: "object",
      additionalProperties: false,
      required: ["x", "y", "z"],
      properties: { x: { const: 0 }, y: { const: 0 }, z: { const: 0 } },
    },
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
    blockSummary: {
      type: "object",
      additionalProperties: false,
      required: PHASE_A_BLOCK_IDS,
      properties: counts,
    },
    validation: {
      type: "object",
      additionalProperties: false,
      required: ["errors", "warnings"],
      properties: {
        errors: { const: 0 },
        warnings: { type: "array", items: { type: "string" }, maxItems: 100 },
      },
    },
    preview: {
      type: "object",
      additionalProperties: false,
      required: ["view"],
      properties: { view: { const: "isometric" } },
    },
  },
} as const;
