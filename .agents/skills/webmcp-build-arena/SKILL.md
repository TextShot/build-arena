---
name: webmcp-build-arena
description: Use this when adding, changing, or reviewing WebMCP / site MCP tools for the Build Arena. Walks an agent through naming, JSON Schema, wrapping the command engine, registering with document.modelContext, and verifying. Do not use for a standalone backend MCP server.
---

# Build WebMCP tools

This skill is a **how-to**. Follow it whenever you add or change a page tool. Do not invent a backend MCP server. Tools live on the open Build Arena tab.

```text
You (agent)  -->  host schema  -->  thin adapter  -->  full AJV schema  -->  arena command engine
                                                                    |
                                                                    v
                                                          world store --> Three.js
```

Load `references/agentic-javascript-tools.md` before writing `registerTool` code. Load `references/webmcp.md` if you need the rules. Load `references/tool-recipes.md` for copy-paste schemas.

## 1. Decide if this should be a tool

Add a tool only if a human can already do the same thing through the command engine (or you will add that command first).

| Do add a tool | Do not add a tool |
| --- | --- |
| Read arena state (`get_arena_context`) | Arbitrary JS / eval / shell |
| Place, replace, remove, generate shapes | Direct Three.js or Zustand writes |
| Undo, save blueprint | Hidden `choose_block` palette state |
| Query a region or slice | Dump the whole world every turn |

Use the **imperative** API (`document.modelContext.registerTool`). Do not use HTML `toolname` forms for arena commands. Forms cannot do batches, revisions, or atomic replace.

## 2. Build the command first

If `src/core/` cannot do the action yet, implement it there **before** the tool.

1. Add or reuse a function in `arena-commands.ts` / `arena-queries.ts`.
2. Validate with the same JSON Schema the tool will use (`src/schemas/`).
3. Writes must be atomic, revisioned, and recorded in history.
4. Unit-test the command. Then wrap it.

Never put voxel math inside `execute`. `execute` only: parse input, call the engine, shape the result.

## 3. File the tool in the adapter

Keep tools in:

```text
src/webmcp/
  register-arena-tools.ts   register + AbortController
  host-catalog-payload.ts   byte-small host descriptors
  tool-schemas.ts           JSON Schema per tool
  tool-results.ts           success / error shapes
```

One tool = one full execute schema + one `execute` wrapper + one `registerTool` call. The host-visible schema may be a deliberate stub for non-discovery tools.

## 4. Name, describe, schema

- Name: `verb_noun`, snake_case, exact behaviour (`set_blocks`, not `do_edit`).
- Description: what it does, what it returns, important limits. Positive. No "don't call X after Y".
- Full execute schema: every property has `type` and `description`.
- Always `additionalProperties: false`.
- Enums for block ids and axes. Integer coordinates. Max array lengths.
- Reads: empty or filter object. Arena mutations include `expectedRevision`; UI-only lock state does not change the arena revision.
- Optional `dryRun` on large writes.

**Build Arena / Codex Browser optimization only:** keep `list_tools` and `describe_tools` fully described at registration. Other host descriptors use the shared permissive stub from `host-catalog-payload.ts`; `describe_tools({name})` returns the selected full schema. Handlers must still validate every call with `ARENA_TOOL_SCHEMAS`. Never use the permissive host stub for execute-time validation, and do not copy this optimization to another WebMCP host without measuring and testing that host.

Fresh-agent reliability is not established by unit tests or by an informed agent reusing the same task. Before shipping changes to this flow, open a fresh Codex task with no prior schema context and verify it follows `list_tools` → `describe_tools({name})` → target tool. Until that passes, describe the host stubs as experimental rather than proven reliable.

Phase A block ids: `dirt`, `stone`, `oak_log`, `oak_planks`, `leaves`, `glass`, `obsidian`.

Coordinates are `(x, y, z)`. X/Z ground, Y height. Platform at `y = 0` is read-only.

## 5. Connect host descriptors to validated handlers

Use the same descriptor builder that the byte-budget test measures. `createArenaToolHandlers` compiles and validates `ARENA_TOOL_SCHEMAS`; the host stub never replaces that validation.

```ts
const handlers = createArenaToolHandlers(engine, hooks);

for (const descriptor of buildHostToolDescriptors()) {
  await document.modelContext.registerTool(
    {
      ...descriptor,
      execute: (args) => handlers[descriptor.name](args),
    },
    { signal },
  );
}
```

Read tools: `annotations: { readOnlyHint: true }` **after** `execute`.

Write success must look like:

```json
{
  "success": true,
  "revision": 43,
  "affectedBlocks": 720,
  "affectedBounds": {
    "min": { "x": -3, "y": 1, "z": -3 },
    "max": { "x": 3, "y": 4, "z": 3 }
  },
  "warnings": [],
  "undoId": "change-43"
}
```

Errors: `{ "success": false, "error": "human readable", "fieldPath": "edits.0.y" }`. Enough for the agent to retry.

## 6. Register and clean up

Register only while the Build Arena page is mounted.

```ts
const modelContext = document.modelContext;
if (!modelContext || !("registerTool" in modelContext)) return; // human UI still works

const controller = new AbortController();

for (const tool of arenaTools(engine)) {
  await modelContext.registerTool(tool, { signal: controller.signal });
}

// on unmount / leaving the arena tab:
controller.abort();
```

There is no `unregisterTool()`. Abort the signal. Do not re-register just because blocks changed. Return new data through read results.

HTTPS only. Feature-detect. Preview: Chromium 146+ and `#enable-webmcp-testing`.

## 7. Ship the starter set in this order

Build these, and only these, until they work. Details and schemas: `references/tool-recipes.md`.

| # | Tool | Kind | Engine call |
| --- | --- | --- | --- |
| 1 | `list_tools` | read | short names, use cases, examples |
| 2 | `describe_tools` | read | one full input schema + example |
| 3 | `get_arena_context` | read | config + block catalogue + revision |
| 4 | `get_build_summary` | read | counts, occupied bounds, revision |
| 5 | `query_blocks` | read | region / layer / type filter |
| 6 | `get_build_slices` | read | 2D X/Z, X/Y, Z/Y grids |
| 7 | `set_manual_edit_lock` | UI write | lock human writes before agent mutations; unlock when finished |
| 8 | `set_blocks` | write | place / atomic replace / remove |
| 9 | `generate_shape` | write | floor, wall, filled/hollow box; later run-strings |
| 10 | `undo_build_change` | write | undo one history entry |
| 11 | `render_build_views` | read-ish | update visible diagnostic views, return ids |
| 12 | `transform_region` | write | copy / move / rotate / mirror / replace type |
| 13 | `save_blueprint` | write | validate + serialize |

Agent loop those tools should support. Arena mutations reject unless the manual edit lock is active; release it in the final step even after a failure:

```text
set_manual_edit_lock(true) → get_arena_context → get_build_summary → query/slice
        → one bounded write → check revision/bounds → query again
        → render only if needed → set_manual_edit_lock(false)
```

## 8. Check before you stop

- [ ] Command exists in `src/core/` and has a test
- [ ] Tool is a thin wrapper (no extra voxel logic)
- [ ] Full execute schema is narrow, described, `additionalProperties: false`
- [ ] Discovery tools retain real host schemas; other host schemas use the shared stub
- [ ] `describe_tools` requires one name and returns that tool's full input schema
- [ ] Compact host descriptors remain within the named byte budget
- [ ] A fresh Codex task follows discovery before calling a stubbed tool; otherwise reliability remains unverified
- [ ] Read tools have `readOnlyHint: true`
- [ ] Writes take `expectedRevision` and return revision + bounds + undoId
- [ ] Arena mutations require the manual edit lock; normal completion and timeout both release it
- [ ] Writes are atomic
- [ ] Registered with `AbortController`; aborted on unmount
- [ ] Feature-detected; app works without WebMCP
- [ ] No secrets, no eval, no dump-the-world
- [ ] Human UI uses the same command

## Do not

- `navigator.registerTool` (old)
- MCP HTTP / SSE / stdio from this skill
- Resources or Prompts primitives
- `choose_block` as agent-only hidden state
- Replace = break then place (must be one command)
- Auto-submit anything destructive
