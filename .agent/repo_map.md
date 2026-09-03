# Build Arena repository map

## WebMCP build summaries

- `src/webmcp/tool-handlers.ts`: `get_build_summary` removes zero-valued material counts and omits `objectGroups` unless `includeObjectGroups:true`. `describe_tools` defaults to schema for compatibility and becomes compact only for `detail:"compact"`.
- `src/webmcp/tool-results.ts:4-8`: `jsonToolResult` emits one JSON text content item, so removing unused summary fields before this call directly reduces agent response tokens.
- `src/core/arena-queries.ts:97-131`: core `getSummary` computes `blockCount`, material counts, occupied bounds, and object groups. It initializes every `ALL_BLOCK_IDS` count to zero; this full internal summary is also used outside WebMCP and should remain unchanged for this optimization.
- `src/core/arena-engine.ts:202-234`: `BuildSummary` and `ArenaEngine.getSummary()` define the engine-facing summary contract.
- `src/webmcp/tool-schemas.ts:122-126`: `get_build_summary` schema documents the WebMCP summary as a census of placed blocks; it has no arguments.
- `src/webmcp/tool-catalog.ts:42-46`: discovery guidance tells agents when to use `get_build_summary`; update this text if the WebMCP response omits zero-count materials.
- `src/webmcp/register-arena-tools.ts:35-57`: page registration wires host descriptors to the validated handlers; no summary-specific logic lives here.

## Regression surface

- `src/webmcp/tool-handlers.test.ts:21-37`: read-only handler coverage, including the empty summary path.
- `src/webmcp/tool-handlers.test.ts:75-85`: summary payload coverage after a generated shape; a focused assertion here can prove zero-count materials are omitted while non-zero counts remain.
- `src/core/arena-queries.test.ts:7-31`: core summary coverage expects the complete count map, so it should not be changed for a WebMCP-only token optimization.
- `src/webmcp/host-catalog-payload.test.ts` and `src/webmcp/register-arena-tools.test.ts`: host descriptor size/registration coverage; only relevant if the discovery description itself changes.

## Boundary

Keep the engine/UI `BuildSummary` contract complete. The WebMCP summary always preserves `revision`, `blockCount`, and `occupiedBounds`, filters zero counts, and conditionally includes `objectGroups`. Successful mutations should chain the returned revision; state is re-read after errors and once at final verification.
