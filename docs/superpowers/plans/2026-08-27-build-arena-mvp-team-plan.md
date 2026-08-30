# Build Arena MVP Team Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the Build Arena through Phase 5: a human and a supported browser agent can build, inspect, export/import, and undo Phase A voxel edits through one shared command engine.

**Architecture:** A plain-TypeScript arena core owns the world, validation, commands, queries, revisions, and history. React, Three.js, blueprint JSON, and WebMCP are adapters around that core and must never create parallel mutation paths.

**Tech Stack:** Vite, TypeScript, React, Three.js, Zustand, Ajv, Vitest, WebMCP imperative API.

**Spec:** `docs/BUILD_ARENA_PLAN.md`

## Global Constraints

- Scope ends after Phase 5; game placement, partial blocks, redstone, and the run-string parser are not MVP implementation work.
- Coordinates are always `(x, y, z)`; X/Z are ground axes and Y is height.
- The default platform is 7x7 at `y = 0`, remains centred, and cannot be edited.
- Phase A block ids are `dirt`, `stone`, `oak_log`, `oak_planks`, `leaves`, `glass`, and `obsidian`.
- Every mutation is validated, bounded, atomic, revisioned, and undoable.
- React and Zustand never store the voxel world; Three.js never becomes the source of truth.
- Human UI and WebMCP call the same `ArenaEngine` methods.
- WebMCP uses `document.modelContext.registerTool`, feature detection, and `AbortController` cleanup.
- Blueprint interchange is versioned JSON. The compact run-string DSL is deferred until shape operations in Phase 6.
- No worker may add backend MCP transports, arbitrary code execution, fluid simulation, chunks, or greedy meshing.
- Reference images exist in a directory literally named `assets ` (with a trailing space). They confirm the 7x7 X/Z grid, Y-height convention, and sidebar concept, but that directory name is not a valid `/assets/...` runtime path; keep core work independent and normalize the asset path during renderer/UI work.
- Mayank runs broad verification; workers provide focused copy-paste commands and record expected results.

---

## Team and ownership

| Member | Owns | Must not own |
| --- | --- | --- |
| Core architect | Contracts, sequencing, cross-subsystem decisions, integration review | Parallel feature implementation unless a worker is blocked |
| Arena-core engineer | `src/core/`, one core invariant test file | React, Three.js, WebMCP registration |
| Block/renderer designer | `src/render/`, Phase A procedural block appearance, manual visual QA | World mutation or validation |
| Frontend designer/engineer | `src/app/`, `src/ui/`, `src/state/` | Voxel storage or direct mesh mutation |
| Schema/blueprint engineer | `src/schemas/`, `src/storage/`, one blueprint round-trip test | A second command model or MVP DSL parser |
| WebMCP engineer | `src/webmcp/`, thin adapter tests | Voxel math, direct Zustand/Three.js writes |
| Integration reviewer | Accessibility/manual QA checklist | Rewriting feature code before reporting findings |

The JSON/DSL role is intentionally combined with blueprint contracts. A standalone “JSON maker” would duplicate domain rules, while an MVP DSL implementer would build Phase 6 early. The core owns domain validation; schemas only validate input structure.

## Dependency flow

```text
Task 0: frozen contracts
          |
          v
Task 1: arena core -------------------+
   |                                  |
   +--> Task 2: Three.js renderer      |
   +--> Task 3: React editor UI        +--> Task 6: integration gate
   +--> Task 4: blueprint JSON         |
   `--> Task 5: WebMCP tools ----------+
```

Tasks 2–4 may begin against Task 0 interfaces, but they cannot pass their gate until Task 1 is working. Task 5 begins only after the relevant core commands and queries pass tests.

---

### Task 0: Freeze the shared arena contracts

**Owner:** Core architect with arena-core engineer.

**Files:**
- Create: `src/core/coordinates.ts`
- Create: `src/core/block-types.ts`
- Create: `src/core/arena-config.ts`
- Create: `src/core/arena-engine.ts`

**Produces:**

```ts
type Coordinate = Readonly<{ x: number; y: number; z: number }>;
type BlockId = "dirt" | "stone" | "oak_log" | "oak_planks" | "leaves" | "glass" | "obsidian";
type ArenaCommandResult =
  | { success: true; revision: number; affectedBlocks: number; affectedBounds: Bounds; warnings: string[]; undoId: string }
  | { success: false; error: string; fieldPath?: string };

interface ArenaEngine {
  apply(command: ArenaCommand): ArenaCommandResult;
  getContext(): ArenaContext;
  getSummary(): BuildSummary;
  queryBlocks(query: BlockQuery): BlockQueryResult;
  getSlice(query: SliceQuery): BuildSlice;
  subscribe(listener: (change: ArenaChange) => void): () => void;
}
```

- [ ] Define coordinate, bounds, block, command, query, result, and change-event types.
- [ ] Encode the centred 7x7 default bounds and immutable `platformY: 0`.
- [ ] Share the TypeScript contract types with each adapter owner; do not add a separate contracts test file.
- [ ] Architect reviews names once; downstream workers consume them without local variants.
- [ ] Commit as `chore: define arena contracts`.

**Gate:** All members can explain what they consume and produce without reading another member’s internals.

---

### Task 1: Build the plain-TypeScript arena core

**Owner:** Arena-core engineer.

**Files:**
- Create: `src/core/arena-world.ts`
- Create: `src/core/arena-commands.ts`
- Create: `src/core/arena-queries.ts`
- Create: `src/core/validation.ts`
- Create: `src/core/history.ts`
- Test: `src/core/arena-core.test.ts`

**Consumes:** Task 0 contracts.

**Produces:** A framework-free `ArenaEngine` instance used by every later task.

- [ ] Implement coordinate-key round-trip and sparse `Map<CoordinateKey, Block>` storage.
- [ ] Cover default bounds, platform immutability, place/remove/atomic replace, reject/rollback, undo/redo, and one slice/query read in `arena-core.test.ts`.
- [ ] Implement bounded place, remove, and atomic replace batches.
- [ ] Reject unknown blocks, out-of-bounds positions, oversized batches, and stale revisions before committing.
- [ ] Calculate the entire diff first, then commit it once and increment one revision.
- [ ] Record exact before/after diffs for undo and redo.
- [ ] Implement context, summary, paginated region/layer/type query, and exact 2D slice reads.
- [ ] Publish one change event per committed command for renderer and UI subscribers.
- [ ] Commit core pieces in focused increments.

**Gate:** The complete arena can be manipulated and inspected in tests without React, Three.js, Zustand, or WebMCP.

---

### Task 2: Render and interact with Phase A blocks

**Owner:** Block/renderer designer.

**Files:**
- Create: `src/render/three-renderer.ts`
- Create: `src/render/block-mesh-registry.ts`
- Create: `src/render/arena-grid.ts`
- Create: `src/render/selection-highlight.ts`
- Create: `src/render/camera-controls.ts`

**Consumes:** `ArenaEngine.subscribe`, query reads, Task 0 block ids and coordinates.

**Produces:** A renderer controller with mount, resize, camera-preset, selection, world-change, and dispose operations.

- [ ] Render a centred protected platform and labelled X/Z orientation.
- [ ] Give all seven Phase A blocks distinct, original procedural materials; do not copy Minecraft textures.
- [ ] Group identical cubes with `InstancedMesh`.
- [ ] Subscribe to committed arena changes and update only affected instance groups.
- [ ] Add raycast hover/click selection that reports exact coordinates but never mutates the world.
- [ ] Add top, front, right, and isometric camera presets.
- [ ] Dispose controls, geometries, materials, subscriptions, and renderer resources.
- [ ] Commit as one renderer feature after its focused tests and manual checklist are ready.

**Gate:** A core command changes the visible scene, and the selected visible coordinate matches the queried core coordinate.

---

### Task 3: Build the accessible React editor UI

**Owner:** Frontend designer/engineer.

**Files:**
- Create: `src/app/App.tsx`
- Create: `src/ui/BuildArenaPage.tsx`
- Create: `src/ui/BlockPalette.tsx`
- Create: `src/ui/ArenaControls.tsx`
- Create: `src/ui/CoordinateInspector.tsx`
- Create: `src/ui/ValidationPanel.tsx`
- Create: `src/ui/HistoryControls.tsx`
- Create: `src/state/ui-store.ts`

**Consumes:** `ArenaEngine`, renderer controller, Task 0 contracts.

**Produces:** Human controls that translate intent into the same core commands used by WebMCP.

- [ ] Store only palette selection, selected coordinate, camera preset, validation display, and revision summary in Zustand.
- [ ] Implement labelled palette, coordinate inspector, place/replace/remove controls, undo/redo, and camera presets.
- [ ] Make validation errors identify a field path or coordinate and never rely on colour alone.
- [ ] Support keyboard focus and text labels outside the canvas.
- [ ] Keep arena dimensions fixed at 7x7 for the first integration gate; resizing follows only after centred resize semantics are specified.
- [ ] Confirm UI actions call `ArenaEngine.apply` and never touch world maps or Three.js objects.
- [ ] Commit after keyboard and mouse manual checks are documented.

**Gate:** A human can reliably place, replace, remove, and undo Phase A blocks while seeing exact coordinates and errors.

---

### Task 4: Implement blueprint JSON interchange

**Owner:** Schema/blueprint engineer.

**Files:**
- Create: `src/schemas/commands.schema.ts`
- Create: `src/schemas/blueprint.schema.ts`
- Create: `src/core/blueprint.ts`
- Create: `src/storage/blueprint-json.ts`
- Test: `src/core/blueprint.test.ts`

**Consumes:** Core block, coordinate, world-query, and validation contracts.

**Produces:** `BlueprintV1`, Ajv schemas, deterministic export, and validated import commands.

- [ ] Define `schemaVersion: 1`, local coordinates, anchor, size, blocks, counts, validation summary, and preview metadata.
- [ ] Export blocks in stable coordinate order for readable diffs.
- [ ] Parse JSON separately from schema/domain validation so syntax errors can include line/column and domain errors can include field paths.
- [ ] Convert valid imports into one bounded core command; never write the sparse map directly.
- [ ] Test one export/import round-trip with negative X/Z coordinates in `blueprint.test.ts`. Do not add a second storage test file.
- [ ] Reserve a documented future run-string field only if the current blueprint schema needs forward compatibility; do not create `pattern-dsl.ts` in this MVP.
- [ ] Commit as `feat: add blueprint json interchange`.

**Gate:** Export followed by import reproduces the same blocks and block counts without coordinate loss.

---

### Task 5: Expose the arena through WebMCP

**Owner:** WebMCP engineer.

**Files:**
- Create: `src/webmcp/tool-schemas.ts`
- Create: `src/webmcp/tool-results.ts`
- Create: `src/webmcp/register-arena-tools.ts`
- Test: `src/webmcp/register-arena-tools.test.ts`

**Consumes:** Tested core commands/queries and shared schema fragments.

**Produces:** Page-scoped, thin WebMCP tools.

- [ ] Implement reads first: `get_arena_context`, `get_build_summary`, `query_blocks`, and `get_build_slices`.
- [ ] Implement writes next: `set_blocks` and `undo_build_change`.
- [ ] Add `save_blueprint` only after Task 4 passes its gate.
- [ ] Defer `generate_shape`, `transform_region`, and the run-string DSL to Phase 6.
- [ ] Require `expectedRevision` for writes, reject extra schema properties, and cap edit arrays at 256.
- [ ] Make every `execute` wrapper only validate/parse, call the engine, and shape the response.
- [ ] Register through feature-detected `document.modelContext` with one `AbortController`; abort on page unmount.
- [ ] In `register-arena-tools.test.ts`, cover only: missing `document.modelContext`, a stale write rejection, and AbortController cleanup.
- [ ] Verify the current WebMCP API against authoritative sources immediately before implementation because it is preview technology.
- [ ] Commit as `feat: expose arena webmcp tools`.

**Gate:** A supported browser agent can inspect, edit, re-read, save, and undo without bypassing the same rules used by the human UI.

---

### Task 6: Integration and release gate

**Owner:** Integration reviewer; fixes return to the original owner.

**Files:**
- Create: `docs/MVP_MANUAL_QA.md`

**Consumes:** Tasks 1–5.

**Produces:** A short concise manual checklist Mayank can run. No automated integration-flow test file.

- [ ] Document one shared flow for manual QA: human edit → agent stale-write rejection → agent re-read → agent edit → undo → export → clear → import.
- [ ] Verify the platform remains immutable through UI, import, and WebMCP paths.
- [ ] Verify every view reports X/Z/Y correctly and the top view is X/Z.
- [ ] Verify the app remains fully usable when `document.modelContext` is absent.
- [ ] Check keyboard access, text labels, contrast, and non-colour validation feedback.
- [ ] Review for direct writes to Zustand, Three.js, or the sparse map outside the core.
- [ ] Give Mayank focused commands for the three Vitest files, type checking, build, and browser QA; do not run broad checks without his request.

**Gate:** Every MVP success criterion in `docs/BUILD_ARENA_PLAN.md` has core/blueprint/WebMCP test evidence or an item in `docs/MVP_MANUAL_QA.md`, and no unresolved critical risk.

---

## Integration rules for the team

1. One task owner per directory; cross-owner edits require architect approval.
2. Contract changes land before consumer changes and include migration notes for every affected member.
3. Workers never “temporarily” bypass the engine to unblock visual progress.
4. Reviews happen at each gate, not only after all branches are complete.
5. Failed review work returns to its original owner so responsibility stays clear.
6. Merge order is Task 0 → Task 1 → Tasks 2/3/4 → Task 5 → Task 6.

## Main risks and handling

| Risk | Handling |
| --- | --- |
| Workers invent different coordinate/result types | Freeze Task 0 contracts and reject local variants |
| Frontend or renderer creates a second world state | Enforce engine-only mutation and integration grep/review |
| WebMCP work starts too early | Start only after relevant core methods pass tests |
| JSON Schema duplicates domain validation | Schema checks shape; core checks arena rules |
| DSL expands MVP scope | Defer parser and shape operations to Phase 6 |
| The trailing-space `assets ` path breaks normal runtime URLs | Normalize the directory during renderer/UI work; keep core contracts asset-independent |
| Parallel branches conflict | Assign directory ownership and merge by dependency order |
| Preview WebMCP API drifts | Re-verify official sources immediately before Task 5 |

## MVP completion boundary

Stop when humans and supported browser agents can reliably edit the same Phase A arena, inspect exact state, undo changes, and round-trip blueprint JSON. Do not continue into inventory placement, game terrain, partial blocks, run-string generation, or redstone without a new approved plan.
