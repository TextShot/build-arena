import type { ArenaEngine } from "../core/arena-engine";
import { buildHostToolDescriptors } from "./host-catalog-payload";
import { createArenaToolHandlers, type ArenaToolHooks } from "./tool-handlers";
import type { ModelContext } from "./webmcp-types";

export type RegisterArenaToolsOptions = Readonly<{
  /** Aborting removes every page-scoped registration (WebMCP draft behavior). */
  signal: AbortSignal;
  hooks?: ArenaToolHooks;
  /** Injection point for tests; defaults to the feature-detected document.modelContext. */
  modelContext?: ModelContext;
  /** Reports registration failures after all partial registrations have been removed. */
  onRegistrationError?: (error: unknown) => void;
}>;

/**
 * Registers the Build Arena tools once for the current page context.
 * Feature-detects document.modelContext: unsupported browsers keep the full
 * human editor and this function simply returns false.
 *
 * Tools read fresh engine state on every call, so block/revision changes never
 * require re-registration.
 */
export async function registerArenaTools(
  engine: ArenaEngine,
  options: RegisterArenaToolsOptions,
): Promise<boolean> {
  const modelContext = options.modelContext ??
    (typeof document !== "undefined" ? document.modelContext : undefined);
  if (!modelContext || typeof modelContext.registerTool !== "function" || options.signal.aborted) {
    return false;
  }

  const registrationController = new AbortController();
  const abortRegistrations = () => registrationController.abort(options.signal.reason);
  options.signal.addEventListener("abort", abortRegistrations, { once: true });

  try {
    const handlers = createArenaToolHandlers(engine, options.hooks);
    for (const descriptor of buildHostToolDescriptors()) {
      if (registrationController.signal.aborted) {
        throw registrationController.signal.reason ?? new Error("Tool registration aborted");
      }
      await modelContext.registerTool(
        {
          ...descriptor,
          execute: (args: unknown) => handlers[descriptor.name](args),
        },
        { signal: registrationController.signal },
      );
    }
    return true;
  } catch (error) {
    registrationController.abort(error);
    options.signal.removeEventListener("abort", abortRegistrations);
    options.onRegistrationError?.(error);
    return false;
  }
}
