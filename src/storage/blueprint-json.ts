import Ajv from "ajv";

import { DEFAULT_ARENA_CONFIG, type ArenaConfig } from "../core/arena-config";
import { createBlueprint, type BlueprintV1 } from "../core/blueprint";
import { PHASE_A_BLOCK_IDS } from "../core/block-types";
import { coordinateKey } from "../core/coordinates";
import { validateArenaPosition } from "../core/validation";
import { BLUEPRINT_V1_SCHEMA } from "../schemas/blueprint.schema";

export type BlueprintParseResult =
  | Readonly<{ success: true; blueprint: BlueprintV1 }>
  | Readonly<{ success: false; error: string; fieldPath?: string }>;

const ajv = new Ajv({ allErrors: true, strict: true });
const validateBlueprint = ajv.compile<BlueprintV1>(BLUEPRINT_V1_SCHEMA);

export function serializeBlueprintJson(blueprint: BlueprintV1): string {
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

  if (!validateBlueprint(value)) {
    const issue = validateBlueprint.errors?.[0];
    return {
      success: false,
      error: issue?.message ? `Blueprint ${issue.message}` : "Blueprint does not match schema version 1",
      fieldPath: issue?.instancePath || "blueprint",
    };
  }

  const seen = new Set<string>();
  for (let index = 0; index < value.blocks.length; index += 1) {
    const block = value.blocks[index];
    const positionFailure = validateArenaPosition(
      block.position,
      arenaConfig,
      `blocks[${index}].position`,
    );
    if (positionFailure) return { success: false, ...positionFailure };
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

  const canonical = createBlueprint(value.blocks, { id: value.id, name: value.name });
  if (
    value.size.x !== canonical.size.x ||
    value.size.y !== canonical.size.y ||
    value.size.z !== canonical.size.z
  ) {
    return { success: false, error: "Blueprint size does not match its blocks", fieldPath: "size" };
  }
  if (PHASE_A_BLOCK_IDS.some((blockId) => value.blockSummary[blockId] !== canonical.blockSummary[blockId])) {
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
      validation: Object.freeze({ errors: 0, warnings: Object.freeze([...value.validation.warnings]) }),
    }),
  };
}

export function downloadBlueprintJson(blueprint: BlueprintV1): void {
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

function safeFilename(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || "build-arena-blueprint";
}

function formatJsonError(error: unknown): string {
  const message = error instanceof Error ? error.message : "JSON is invalid";
  return `JSON error: ${message}`;
}
