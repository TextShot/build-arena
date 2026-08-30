import type { ArenaResult } from "../core/arena-engine";
import type { ToolCallResult } from "./webmcp-types";

/** Wraps a structured payload as one JSON text content item. */
export function jsonToolResult(payload: unknown): ToolCallResult {
  return Object.freeze({
    content: Object.freeze([Object.freeze({ type: "text" as const, text: JSON.stringify(payload) })]),
  });
}

export function errorToolResult(error: string, fieldPath?: string, revision?: number): ToolCallResult {
  return Object.freeze({
    content: Object.freeze([
      Object.freeze({
        type: "text" as const,
        text: JSON.stringify({
          success: false,
          error,
          ...(fieldPath !== undefined ? { fieldPath } : {}),
          ...(revision !== undefined ? { revision } : {}),
        }),
      }),
    ]),
    isError: true,
  });
}

/** Maps an engine result to a tool result, preserving revision/bounds/undoId. */
export function arenaResultToolResult(result: ArenaResult): ToolCallResult {
  if (!result.success) {
    return errorToolResult(result.error, result.fieldPath, result.revision);
  }
  return jsonToolResult(result);
}
