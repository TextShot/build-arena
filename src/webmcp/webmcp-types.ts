/**
 * Minimal typings for the WebMCP draft API:
 * https://webmachinelearning.github.io/webmcp/
 *
 * Tools register once per page context via document.modelContext.registerTool
 * and are removed when the provided AbortSignal aborts.
 */

export type ToolContent = Readonly<{ type: "text"; text: string }>;

export type ToolCallResult = Readonly<{
  content: readonly ToolContent[];
  isError?: boolean;
}>;

export type ToolAnnotations = Readonly<{
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
}>;

export type ToolDescriptor = Readonly<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: ToolAnnotations;
  execute: (args: unknown) => Promise<ToolCallResult> | ToolCallResult;
}>;

export type ModelContext = Readonly<{
  registerTool(tool: ToolDescriptor, options?: { signal?: AbortSignal }): Promise<void>;
}>;

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}
