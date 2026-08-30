import Ajv from "ajv";

import { DEFAULT_ARENA_CONFIG, type ArenaConfig } from "../core/arena-config";
import {
  createBlueprint,
  migrateBlueprintV1ToV2,
  type BlueprintV1,
  type BlueprintV2,
} from "../core/blueprint";
import { ALL_BLOCK_IDS, normalizeBlockState } from "../core/block-types";
import { coordinateKey } from "../core/coordinates";
import { validateArenaPosition } from "../core/validation";
import { BLUEPRINT_V1_SCHEMA, BLUEPRINT_V2_SCHEMA } from "../schemas/blueprint.schema";

export type BlueprintParseResult =
  | Readonly<{ success: true; blueprint: BlueprintV2 }>
  | Readonly<{ success: false; error: string; fieldPath?: string }>;

const ajv = new Ajv({ allErrors: true, strict: true });
const validateBlueprintV1 = ajv.compile<BlueprintV1>(BLUEPRINT_V1_SCHEMA);
const validateBlueprintV2 = ajv.compile<BlueprintV2>(BLUEPRINT_V2_SCHEMA);

export function serializeBlueprintJson(blueprint: BlueprintV2): string {
  return `${JSON.stringify(blueprint, null, 2)}\n`;
}

export function parseBlueprintJson(
  text: string,
  arenaConfig: ArenaConfig = DEFAULT_ARENA_CONFIG,
): BlueprintParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { success: false, error: formatJsonError(error) };
  }

  if (value === null || typeof value !== "object") {
    return { success: false, error: "Blueprint must be a JSON object", fieldPath: "blueprint" };
  }
  const schemaVersion = (value as { schemaVersion?: unknown }).schemaVersion;

  let candidate: BlueprintV2;
  if (schemaVersion === 1) {
    if (!validateBlueprintV1(value)) {
      return schemaFailure(validateBlueprintV1.errors, 1);
    }
    candidate = migrateBlueprintV1ToV2(value);
  } else if (schemaVersion === 2) {
    if (!validateBlueprintV2(value)) {
      return schemaFailure(validateBlueprintV2.errors, 2);
    }
    candidate = value;
  } else {
    return {
      success: false,
      error: "schemaVersion must be 1 or 2",
      fieldPath: "schemaVersion",
    };
  }

  const seen = new Set<string>();
  for (let index = 0; index < candidate.blocks.length; index += 1) {
    const block = candidate.blocks[index];
    const positionFailure = validateArenaPosition(
      block.position,
      arenaConfig,
      `blocks[${index}].position`,
    );
    if (positionFailure) return { success: false, ...positionFailure };
    const normalized = normalizeBlockState(block.block, block.state);
    if (!normalized.ok) {
      return { success: false, error: normalized.error, fieldPath: `blocks[${index}].state` };
    }
    const key = coordinateKey(block.position);
    if (seen.has(key)) {
      return {
        success: false,
        error: "Blueprint contains a duplicate coordinate",
        fieldPath: `blocks[${index}].position`,
      };
    }
    seen.add(key);
  }

  const original = value as { size: { x: number; y: number; z: number }; blockSummary: Record<string, number>; validation: { warnings: readonly string[] } };
  const canonical = createBlueprint(candidate.blocks, { id: candidate.id, name: candidate.name });
  if (
    original.size.x !== canonical.size.x ||
    original.size.y !== canonical.size.y ||
    original.size.z !== canonical.size.z
  ) {
    return { success: false, error: "Blueprint size does not match its blocks", fieldPath: "size" };
  }
  const declaredCounts = original.blockSummary;
  if (ALL_BLOCK_IDS.some((blockId) => (declaredCounts[blockId] ?? 0) !== canonical.blockSummary[blockId])) {
    return {
      success: false,
      error: "Blueprint blockSummary does not match its blocks",
      fieldPath: "blockSummary",
    };
  }

  return {
    success: true,
    blueprint: Object.freeze({
      ...canonical,
      validation: Object.freeze({ errors: 0, warnings: Object.freeze([...original.validation.warnings]) }),
    }),
  };
}

export function downloadBlueprintJson(blueprint: BlueprintV2): void {
  const blob = new Blob([serializeBlueprintJson(blueprint)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename(blueprint.name)}.build-arena.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function schemaFailure(
  errors: readonly { message?: string; instancePath: string }[] | null | undefined,
  version: 1 | 2,
): BlueprintParseResult {
  const issue = errors?.[0];
  return {
    success: false,
    error: issue?.message ? `Blueprint ${issue.message}` : `Blueprint does not match schema version ${version}`,
    fieldPath: issue?.instancePath || "blueprint",
  };
}

function safeFilename(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || "build-arena-blueprint";
}

function formatJsonError(error: unknown): string {
  const message = error instanceof Error ? error.message : "JSON is invalid";
  return `JSON error: ${message}`;
}
