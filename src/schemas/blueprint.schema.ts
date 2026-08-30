import { PHASE_A_BLOCK_IDS } from "../core/block-types";

const buildPosition = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y", "z"],
  properties: {
    x: { type: "integer", minimum: -3, maximum: 3 },
    y: { type: "integer", minimum: 0, maximum: 6 },
    z: { type: "integer", minimum: -3, maximum: 3 },
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
        x: { type: "integer", minimum: 0, maximum: 7 },
        y: { type: "integer", minimum: 0, maximum: 6 },
        z: { type: "integer", minimum: 0, maximum: 7 },
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
      maxItems: 294,
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
