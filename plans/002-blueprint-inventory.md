# Plan 002: Inventory, thumbnails, and Arena UI

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 56d47e3..HEAD -- src/storage src/render/three-renderer.ts src/ui/BuildArenaPage.tsx src/ui/BlockPalette.tsx src/state/ui-store.ts vite.config.ts`
> Plan 001 will have already changed some of these. That is expected. Compare Inventory-related code (there should be none yet) against this plan, not against 56d47e3 for files 001 touched.
>
> **Prerequisite**: plan 001 is DONE. `defaultStateFor` and `PALETTE_BLOCK_IDS` must exist.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-merge-block-catalogues.md
- **Category**: direction
- **Planned at**: commit `56d47e3`, 2026-08-28

## Why this matters

Builds currently die on refresh. Export JSON is a download, not a shelf the Play Space can read. Inventory is the shared shelf: same-origin `localStorage`, a front thumbnail, blocks already shifted to a min-corner so the Play Space can transplant them. Without this, plan 003 has nothing to place.

## Current state

- `src/storage/blueprint-json.ts` — parse/serialize `BlueprintV2` for the Export button and JSON apply. Inventory is a **different** on-disk shape: flattened `{x,y,z}` (no nested `position`, no `objectId`) so the Play Space vanilla reader stays tiny. Convert at the boundary with `toRelativeBlocks`. Do not change `BlueprintV2`.
- `src/state/ui-store.ts:10` — the only `localStorage` key is `build-arena.sidebarCollapsed`. Copy its try/catch pattern for quota / private mode.
- `src/ui/BuildArenaPage.tsx:337-338` — Minecraft tab is `disabled` with `title="Opens 3d world"`. No click handler. No router (`src/app/App.tsx` is just `<BuildArenaPage />`).
- `src/ui/BuildArenaPage.tsx:440-456` — Layers `sidebar-panel` ends at the empty state / list. No footer buttons.
- `src/ui/BlockPalette.tsx` — palette buttons only; no overflow slot.
- `src/render/three-renderer.ts:82` — `new WebGLRenderer({ antialias: true, alpha: false })` (no `preserveDrawingBuffer`). `animate` at line 247 renders only when `needsRender`. Thumbnail must force one `this.renderer.render(...)` then `toDataURL` in the same turn.
- `src/ui/BuildArenaPage.tsx:36` — engine starts at `createArenaConfig(51, 31)` matching `DEFAULT_UI_STATE.platformSize`.
- Vite `vite.config.ts` is SPA-only. Dev server still serves repo-root files, so `/MINECRAFT_3D/index.html` is reachable in `npm run dev` without a React route. Plan 003 adds the production multi-page input; this plan only navigates with `window.location.assign("/MINECRAFT_3D/index.html")`.
- Arena world cells never include `y = 0` (protected implicit platform). Inventory therefore naturally omits the platform.

Repo conventions: `src/storage/blueprint-json.test.ts` is the persistence test pattern (round-trip, reject bad JSON, reject duplicates). Match it.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npm run typecheck`| exit 0              |
| Tests     | `npm test`         | all pass            |

## Suggested executor toolkit

- `.cursor/skills/verify-build-arena/SKILL.md` after the Arena UI exists (human path; Vitest will not click the Minecraft tab).

## Scope

**In scope**:
- `src/storage/inventory.ts` (create)
- `src/storage/inventory.test.ts` (create)
- `src/render/three-renderer.ts` (`captureThumbnail` method only)
- `src/ui/BuildArenaPage.tsx` (Layers footer, Minecraft tab, Inventory overlay host, R/M rotate)
- `src/ui/BlockPalette.tsx` (3-dot button)
- `src/ui/InventoryOverlay.tsx` (create — keep small)
- `src/index.css` (Inventory overlay + 3-dot + Layers footer)
- `src/ui/SpaceLoadOverlay.tsx` — do not change (Play Space gets its own copy in 003)

**Out of scope**:
- `MINECRAFT_3D/**` (plan 003). Do not write `inventory.js` here even though the sketch mentioned it — 003 owns the vanilla reader and must copy the key names from this file's exported constants.
- Chat / Claude / WebMCP on the Play Space.
- Changing Export JSON / `BlueprintV2`.
- `preserveDrawingBuffer: true` on the main renderer (thumbnail forces a render instead).

## Git workflow

- Stay on the current branch.
- One commit: `Save Arena builds to a shared Inventory`.
- Do not push.

## Steps

### Step 1: Inventory module

Create `src/storage/inventory.ts`.

Exported constants (Play Space will hardcode the same strings in 003 — keep them short and stable):

```ts
export const INVENTORY_KEY = "build-arena.inventory.v1";
export const HANDOFF_KEY = "build-arena.handoff.v1";
export const INVENTORY_LIMIT = 20;
```

Types:

```ts
export type InventoryBlock = Readonly<{
  x: number; y: number; z: number;
  block: BlockId;
  state?: BlockState;
}>;

export type InventoryEntry = Readonly<{
  id: string;
  name: string;
  createdAt: string; // ISO
  platformSize: number;
  buildHeight: number;
  thumbnail: string; // data URL, jpeg
  blocks: readonly InventoryBlock[];
}>;

export type InventoryFile = Readonly<{
  version: 1;
  entries: readonly InventoryEntry[];
}>;

export type Handoff = Readonly<{
  kind: "visit" | "place";
  platformSize: number;
  buildHeight: number;
  blocks?: readonly InventoryBlock[]; // required when kind === "place"
}>;
```

Functions (all synchronous):

- `toRelativeBlocks(blocks: readonly Block[]): InventoryBlock[]` — for each `Block`, use `block.position`. Subtract min X and min Z among the set. **Keep Y as Arena Y.** Drop `objectId`. Empty input → `[]`.
- `readInventory(): InventoryFile` — missing/corrupt → `{ version: 1, entries: [] }`. Never throw.
- `writeInventory(file: InventoryFile): { ok: true } | { ok: false; error: string }` — quota failure returns `{ ok: false, error: "Inventory is full (browser storage quota)" }`.
- `addEntry(entryWithoutId: Omit<InventoryEntry, "id" | "createdAt">): { ok: true; entry: InventoryEntry } | { ok: false; error: string }` — sets `id: crypto.randomUUID()`, `createdAt: new Date().toISOString()`, prepends, drops the last entry if `entries.length > INVENTORY_LIMIT`, then `writeInventory`.
- `removeEntry(id: string): { ok: true } | { ok: false; error: string }` — filter then `writeInventory`.
- `writeHandoff(handoff: Handoff): { ok: true } | { ok: false; error: string }`
- `readAndClearHandoff(): Handoff | null` — `getItem` then `removeItem`. Corrupt → `null`.

Name: `addEntry` does not invent a name. The Layers button passes `name: \`Build ${readInventory().entries.length + 1}\``. Do not use `toLocaleString()`.

**Verify**: `npx vitest run src/storage/inventory.test.ts` after step 2.

### Step 2: Inventory tests

Create `src/storage/inventory.test.ts` modeled on `src/storage/blueprint-json.test.ts`. Use a mock `localStorage` (assign `globalThis.localStorage` with an in-memory map) so tests run in Vitest's node environment.

Cases:

- relative: blocks at `(2,1,5)` and `(3,2,5)` become `(0,1,0)` and `(1,2,0)`.
- empty world → `blocks: []`.
- round-trip add/read.
- corrupt JSON → empty file.
- 21st insert drops the oldest.
- `writeHandoff` then `readAndClearHandoff` returns the payload and a second read returns `null`.

**Verify**: `npx vitest run src/storage/inventory.test.ts` → all pass.

### Step 3: Thumbnail on ArenaRenderer

Add to `src/render/three-renderer.ts`:

```ts
captureThumbnail(size = 192): string {
  this.renderer.render(this.scene, this.camera);
  const src = this.renderer.domElement;
  const dst = document.createElement("canvas");
  dst.width = size;
  dst.height = size;
  const ctx = dst.getContext("2d");
  if (!ctx || src.width === 0) return "";
  const scale = Math.max(size / src.width, size / src.height);
  const w = src.width * scale;
  const h = src.height * scale;
  ctx.drawImage(src, (size - w) / 2, (size - h) / 2, w, h);
  return dst.toDataURL("image/jpeg", 0.7);
}
```

Keep `preserveDrawingBuffer` false. Callers must invoke this from a click handler (canvas still has pixels).

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Arena UI

In `BuildArenaPage.tsx`:

1. Keep a `rendererInstance` ref that still has the `ArenaRenderer` (today it is only used for camera/selection — extend that ref; do not create a second renderer).
2. Layers panel footer, after the list / empty state, two buttons:
   - **Add to inventory** — `snapshotBlocks()`, skip if empty (status message `"Nothing to save"`); `addEntry` with `captureThumbnail()`, current `platformSize` / `buildHeight`; status on quota failure.
   - **Open in 3D** — `writeHandoff({ kind: "place", platformSize, buildHeight, blocks: toRelativeBlocks(snapshot) })` then `window.location.assign("/MINECRAFT_3D/index.html")`. Does **not** add an Inventory entry. Empty build is still allowed (kind `place` with `blocks: []` is silly — if empty, write `{ kind: "visit", platformSize, buildHeight }` instead).
3. Enable the Minecraft tab: same as Open in 3D but always `kind: "visit"` (no blocks). Set `aria-current` only on Build Arena while on `/`.
4. Inventory overlay state `inventoryOpen`. Render `InventoryOverlay` when true.

   Overlay spec (match existing Arena CSS tokens — frost panel, no new palette):
   - Wrapper: `position: fixed; inset: 0; z-index: 40;` click-backdrop closes. Role `dialog`, `aria-label="Inventory"`.
   - Inner: max-width 480px, centered, existing `--` / panel background from `.sidebar-panel`.
   - Empty copy: `No saved builds`.
   - Each row: 48×48 `<img alt="">` (thumbnail), name text, a Delete button. No "load into Arena".
   - Close: backdrop click or Escape.

5. Rotate stored facing. Live `blockAt` returns only the id (`BuildArenaPage.tsx` ~621–625). Add `cellAt` next to it:

   ```ts
   function cellAt(engine: ArenaEngine, coordinate: Coordinate) {
     return engine.queryBlocks({ region: { min: coordinate, max: coordinate }, limit: 1 }).blocks[0] ?? null;
   }
   ```

   Extend the **existing** `onKeyDown` (the `]`, undo/redo listener around line 249). After `isTypingTarget` (already covers the JSON textarea):

   - If `selectedCoordinate` is null, return.
   - `const cell = cellAt(engine, selectedCoordinate)`.
   - `R` + repeater or comparator: `replace` with next `FACINGS` value (`rotateFacing(cell.state.facing, 1)`).
   - `M` + comparator: `replace` toggling `mode` between `compare` and `subtract`.
   - Send the full `state` object on the replace edit.

Keep CSS additions in `src/index.css` under `.inventory-overlay` and `.layers-footer` (`display: flex; gap: 8px; margin-top: 12px`). 3-dot: `.block-choice.inventory-slot` with the same slot size as `.block-choice`.

**Verify**: `npm run typecheck` → exit 0. `npm test` → exit 0.

## Test plan

- `src/storage/inventory.test.ts` cases in step 2.
- No component test required for the overlay (Vitest environment is `node`). Human check is plan 003's verify skill, plus a smoke: `scripts/launch` if you have browser tools.

Verification: `npm test` → all pass, including 6+ new tests.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0
- [ ] `INVENTORY_KEY` / `HANDOFF_KEY` exported from `src/storage/inventory.ts`
- [ ] Layers panel has **Add to inventory** and **Open in 3D**
- [ ] Minecraft tab is enabled and writes a `visit` handoff
- [ ] Palette has a 3-dot control that opens the overlay
- [ ] `R` rotates a selected repeater/comparator; `M` toggles comparator mode
- [ ] `ArenaRenderer.captureThumbnail` exists
- [ ] No `MINECRAFT_3D/**` changes in this plan
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 001 is not actually done (`defaultStateFor` missing).
- `rendererInstance` was removed in uncommitted work and you cannot capture a thumbnail without a larger renderer rewrite — report rather than turning on `preserveDrawingBuffer`.
- Vitest cannot mock `localStorage` after two attempts — stop; do not switch the whole suite to jsdom.
- You feel the need to load an Inventory entry back into the Arena (explicitly out of scope).

## Maintenance notes

- Quota: jpeg thumbnails at 192px × 20 entries should stay well under 5MB. If someone raises `INVENTORY_LIMIT`, revisit size.
- Reviewer: handoff must be one-shot (`readAndClear`). A sticky handoff would re-enter placement mode on every Play Space refresh.
- Follow-up deferred: importing an Inventory entry back into the Arena; naming dialog.
