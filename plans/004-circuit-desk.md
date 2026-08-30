# Plan 004: Play Space Circuit Desk — player-applied drafts, agent can still run_build_plan ( not implemented plan )

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 4790bab..HEAD -- docs/purpose_builder.md MINECRAFT_3D/index.html MINECRAFT_3D/style.css MINECRAFT_3D/js/main.js MINECRAFT_3D/js/ai.js MINECRAFT_3D/js/agent.js MINECRAFT_3D/js/world.js vite.config.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.
>
> **Prerequisite**: plans 001–003 are DONE. Play Space WebMCP already exists. Do not re-add Claude chat or `#apikey`.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: plans/003-minecraft-3d-play-space.md
- **Category**: direction
- **Planned at**: commit `4790bab`, 2026-08-29

## Why this matters

`docs/purpose_builder.md` asked for a shared programming surface for the player and a connected agent: typed commands + a small grid, a validated draft, ghosts, and Apply/Discard. The live Play Space is not that. `run_build_plan` in `MINECRAFT_3D/js/ai.js` calls `runPlan`, which **mutates immediately** and **keeps going** after invalid actions (half a calculator can land). The Arena at `/` already has revisioned atomic `set_blocks`; this desk is **not** that UI. It is a Play Space HUD so a human can review a circuit before it hits `simulate()`.

Grilled for this plan (do not re-open):

- **Play Space only.** Do not add a Circuit Desk to `src/ui/`.
- **Keep `run_build_plan`.** Agents may still dump a plan into the world. That is the fast path. The desk is the reviewed path.
- **Add `propose_world_edit`.** It must not call `runPlan` / `world.place`. It fills the same draft the HUD Apply button commits.
- **Do not make `runPlan` atomic** in this plan. Partial apply stays. Desk **apply** is the atomic path.

## Canonical product brief (replace `docs/purpose_builder.md` with this)

Copy this section into `docs/purpose_builder.md` in step 1. It is the only version of the brief an executor may follow. The old file is a sketch; `.cursor/rules/stale-early-docs.mdc` would otherwise tell agents to ignore `docs/**`.

```markdown
# In-world Circuit Desk (Play Space)

## Surface

This lives only on the Play Space: `/MINECRAFT_3D/index.html`.
The Arena at `/` already has WebMCP (`set_blocks`, `expectedRevision`). Do not duplicate it here.

## Player

- Aim with the crosshair. Press **B** to open a persistent right-side Circuit Desk (unlock pointer lock, same pattern as **E** Inventory). **E** stays Inventory. **Esc** still pauses (blocker overlay) when the desk is closed.
- Terminal look: black panel, monochrome green text.
- The aim `placeAt` cell is the **anchor** (world integers). The desk shows an **11×11** top-down window centered on that anchor’s XZ, one **Y layer** at a time (default Y = 0, first empty cell on grass). Absolute anchor + active Y are visible. Cells outside the window are not editable from the grid; typed commands that resolve outside the window still enter the draft if they pass world bounds.
- Palette ids (existing `BLOCKS` keys only): `lever`, `redstone_wire`, `redstone_torch`, `repeater`, `comparator`, `lamp`, `piston`, `stone`. **stone** is the support block (torch/wire base). There is no id named `supports`.
- Grid click places/removes using the selected palette id and current layer Y. Repeater/comparator: extra controls for facing `N|E|S|W` and comparator `compare|subtract`.
- Typed commands are **anchor-relative** and compile to the same action objects as the grid:
  - `place lever +1 0 0` → world (anchor.x+1, anchor.y+0, anchor.z+0)  [offsets are dx dy dz]
  - `remove +2 0 0`
  - `rotate +3 0 0` (repeater/comparator already in the world or in the draft)
  - `mode +3 0 0 subtract`
- Invalid lines stay in the input, print a one-line error, and do not enter the draft.

## Draft / transaction

- One in-memory draft: `{ expectedRevision, actions: [...] }` max 200 actions.
- Action shape (world integers, not relative): `{ op: "place"|"remove"|"rotate"|"mode", x, y, z, block?, facing?, mode? }`.
- **Validate all, then apply none or all.** If any action is invalid, the world is unchanged and the HUD lists every error.
- `World` carries `revision` (integer, starts 0). `place`, `remove`, `clear`, `rotateDevice`, `toggleMode` increment it. Apply fails if `draft.expectedRevision !== world.revision` (“stale”).
- Preview: ghost cubes for place/remove in the 3D view (`onFrame` / translucent group, same idea as `placement.js`). Discard clears ghosts and the action list.
- **Only the HUD Apply button** commits a desk draft. Discard drops it.

## Agent

Two tools, two stories — both stay:

| Tool | Mutates world? | Role |
|------|----------------|------|
| `run_build_plan` | Yes, immediately, **partial** (skip bad, keep good) | Fast sandbox. Unchanged behavior. |
| `propose_world_edit` | No | Fills the Circuit Desk draft (absolute world coords, max 200). Player Apply/Discard. |
| `get_world_state` | No | Must also return `revision` and, if the desk is open, `anchor`. |
| `clear_world` | Yes | Unchanged. Player-visible; do not hide it. |
| `place_blueprint_from_inventory` | Yes | Unchanged. |

No in-game model API, no API key field, no `eval`, no backend.

## Out of this product

- Arena React Circuit Desk.
- Abstract AND/XOR compiler. `simulate()` stays the redstone source of truth.
- Treating `two-bit-adder.js` as a reusable primitive. It stays a tutorial/experiment.
```

## Current state

- `docs/purpose_builder.md` — 53-line sketch. Mixes “aim / 3D sim / B HUD” (Play Space) with “no partial AI builds / only player apply” without saying **which page**. Lists a palette item `supports` that is not a `BLOCKS` key. Does not mention `run_build_plan`. Test list is Vitest-shaped, but `vite.config.ts` `test.include` is only `src/**/*.test.ts`.
- `MINECRAFT_3D/js/ai.js` — tools `get_world_state`, `run_build_plan`, `clear_world`, `place_blueprint_from_inventory`. `run_build_plan` → `runPlan`. `get_world_state` returns snapshot, platformSize, radius — **no revision, no anchor**.
- `MINECRAFT_3D/js/agent.js` — `MAX_ACTIONS = 200`. `runPlan` validates per action, **continues** on error, ops `place`|`remove` only (no `rotate`/`mode`). No world revision.
- `MINECRAFT_3D/js/world.js` — `place` / `remove` / `clear` / `rotateDevice` / `toggleMode`. No `this.revision`.
- `MINECRAFT_3D/js/main.js` — **E** toggles Inventory and `world.unlock()`. **Esc** pause overlay. **B** unbound. Pointer lock on Play / canvas click.
- `MINECRAFT_3D/js/placement.js` — ghost group + `world.onFrame` for inventory click-to-place. Desk ghosts must not steal this session; if `isPlacing()` is true, STOP and do not open the desk until that session ends, or cancel placement first (prefer: **B closes inventory placement** via `cancelPlacement()`, then opens the desk).
- `MINECRAFT_3D/js/blocks.js` — `HOTBAR_IDS` 10 redstone/stone types; `BLOCK_IDS = Object.keys(BLOCKS)` (includes oak etc.). Desk palette is the **redstone kit + stone**, not every Catalogue id.
- Arena `src/webmcp/tool-schemas.ts` — `set_blocks` requires `expectedRevision`, edits max 256, atomic engine. **Do not register Arena tool names on the Play Space page.**
- Vitest: `npm test` uses `include: ["src/**/*.test.ts", "src/**/*.test.tsx"]`. `MINECRAFT_3D/js/two-bit-adder.test.js` exists but is **not** in the include list.

Repo conventions: vanilla ES modules under `MINECRAFT_3D/js/` (no React). WebMCP: snake_case, `additionalProperties: false`, `readOnlyHint` on reads, feature-detect `document.modelContext`, `AbortController` on register. Match `registerPlaySpaceTools` in `ai.js`. Tests: Vitest `describe`/`it`/`expect`. There is **no** `npm run lint`. Commands: `npm run typecheck`, `npm test`. Commit style in this repo is short informal (`better UX and expermenting of 2-bits calculator`).

## Commands you will need

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Typecheck | `npm run typecheck` | exit 0              |
| Tests     | `npm test`          | all pass            |

There is no `npm run lint`.

## Suggested executor toolkit

- `.agents/skills/webmcp-build-arena/SKILL.md` when adding `propose_world_edit`.
- Do not read `MINECRAFT_3D/vendor/three.module.js` in full.
- Do not implement from the **old** `docs/purpose_builder.md` after step 1 replaces it.

## Scope

**In scope**:

- `docs/purpose_builder.md` (replace with the canonical brief above)
- `plans/README.md` (status row)
- `vite.config.ts` (`test.include` add `MINECRAFT_3D/js/**/*.test.js`)
- `MINECRAFT_3D/index.html` (`#circuit-desk` markup)
- `MINECRAFT_3D/style.css` (desk panel)
- `MINECRAFT_3D/js/main.js` (**B**, wire desk)
- `MINECRAFT_3D/js/world.js` (`revision` bump)
- `MINECRAFT_3D/js/agent.js` (`applyDraft` atomic; keep `runPlan` partial)
- `MINECRAFT_3D/js/ai.js` (`propose_world_edit`, `get_world_state` extras; keep `run_build_plan`)
- `MINECRAFT_3D/js/circuit-desk.js` (create — parser + desk state; **no THREE import**)
- `MINECRAFT_3D/js/circuit-desk.test.js` (create)
- `MINECRAFT_3D/js/circuit-ghost.js` (create — THREE ghosts; keep in sync with desk actions)

**Out of scope**:

- `src/ui/**`, `src/webmcp/**`, Arena tools
- Deleting `run_build_plan` or changing `runPlan` to atomic
- `two-bit-adder.js` logic (may start running under the new Vitest glob; if it fails, **fix only import/vitest config**, do not change adder math unless the test file itself is broken)
- Claude, `#apikey`, eval, backend
- Expanding Play Space hotbar
- Abstract gate compiler / replacing `simulate()`

## Git workflow

- Stay on the current branch.
- One commit: `Add Play Space Circuit Desk drafts without removing run_build_plan`.
- Do not push.

## Steps

### Step 1: Replace the brief

Overwrite `docs/purpose_builder.md` with the **Canonical product brief** markdown in this plan (the fenced block under that heading), plus a one-line pointer at the top:

`Implementation: plans/004-circuit-desk.md`

**Verify**: `rg "supports" docs/purpose_builder.md` → no match. `rg "Play Space" docs/purpose_builder.md` matches. `rg "run_build_plan" docs/purpose_builder.md` matches.

### Step 2: World revision

In `World` constructor: `this.revision = 0`.

Increment `this.revision` at the end of a **successful** `place`, `remove`, `clear`, `rotateDevice`, `toggleMode` (once per call, not per inner mesh). `place` that no-ops unknown id must **not** increment.

**Verify**: no command — covered by desk tests that mock `{ revision, place, remove }`. If you add a tiny node test, keep it in `circuit-desk.test.js` by injecting a fake world.

### Step 3: Atomic `applyDraft` (do not change `runPlan`)

In `agent.js`, add:

```js
export function applyDraft(world, draft) {
  // 1. missing actions → { ok:false, applied:0, errors:[...] }
  // 2. length > 200 → same, no mutation
  // 3. if draft.expectedRevision !== world.revision → error "stale", no mutation
  // 4. validate every action first (including op rotate/mode). If any error, applied=0, do not mutate.
  // 5. then apply all: place/remove as runPlan; rotate → world.rotateDevice; mode → world.toggleMode until data.mode matches (or set directly if you add world.setMode)
  // 6. return { ok, applied, errors }
}
```

Keep `runPlan` exactly as it is (partial apply, place/remove only).

Validate rotate/mode: target must be a repeater/comparator **in the world** (for apply). For **draft-only** preview, rotate/mode on a cell the draft itself just placed is allowed — resolve in order when validating the full list (walk a copy of occupancy). If that occupancy walk gets messy, STOP and report rather than inventing a third interpreter.

**Verify**: tests in step 6.

### Step 4: Parser + desk module (no THREE)

Create `MINECRAFT_3D/js/circuit-desk.js`:

- `DESK_PALETTE_IDS` = freeze `lever`, `redstone_wire`, `redstone_torch`, `repeater`, `comparator`, `lamp`, `piston`, `stone`.
- `parseCommand(line, anchor)` → `{ ok:true, action }` or `{ ok:false, error }`.
  - Regex-style split on whitespace. Offsets are integers (may be negative). `place <id> <dx> <dy> <dz>`. `remove <dx> <dy> <dz>`. `rotate <dx> <dy> <dz>`. `mode <dx> <dy> <dz> <compare|subtract>`.
  - World coord = `{ x: anchor.x+dx, y: anchor.y+dy, z: anchor.z+dz }`.
- `createDesk({ getWorld, getAnchor, onChange })` returns `{ open, close, isOpen, setLayerY, addFromParse, addFromGrid, propose, apply, discard, getDraft, getErrors }`.
- `propose(actions, expectedRevision)` **replaces** the draft (does not concat) and stores `expectedRevision` from the tool args (required).
- `apply()` calls `applyDraft(getWorld(), getDraft())`.

**Verify**: step 6 tests.

### Step 5: HUD + B + ghosts

`index.html`: add `#circuit-desk` hidden aside (title Circuit Desk, 11×11 table or button grid, Y controls, palette, command `<input>`, log `<pre>`, Apply, Discard).

`style.css`: right side, ~min(360px, 40vw), black, green text (`#00ff66` on `#050805`), z-index above HUD (15) and below pause blocker (20) and inventory (40). z-index 25 is OK if the desk should sit above the hotbar; keep **below** `#blocker.is-open` (20)? Pause must cover the desk — desk z-index **18**, blocker **20**.

`main.js`:

- **B**: if desk open, close it (do not show pause). If closed, `cancelPlacement()`, `closeInventory()`, `hidePauseMenu()`, `world.unlock()`, open desk, set anchor from `world.pickCenter()` → `originFromPick` if pick exists, else `{x:0,y:0,z:0}`.
- While desk `<input>` focused, do not treat keys as movement (world.js already skips TEXTAREA; extend that skip to `INPUT` as well — **this is in-scope** `world.js` keydown, one condition).
- Apply/Discard buttons call desk methods. On successful apply, refresh ghosts off.
- `circuit-ghost.js`: given draft actions + world, show translucent cubes; clear on discard/close. Use `world.onFrame` only if inventory `isPlacing()` is false.

**Verify**: `rg "KeyB" MINECRAFT_3D/js/main.js` matches. `rg "circuit-desk" MINECRAFT_3D/index.html` matches.

### Step 6: WebMCP `propose_world_edit`

In `ai.js`:

- Add tool `propose_world_edit`: input `{ expectedRevision: integer, explain?: string, actions: [...] }` same action item schema as `run_build_plan` **plus** `op` enum `place|remove|rotate|mode`. `additionalProperties: false`. `maxItems: 200`. `readOnlyHint: false` but execute **must not** call `runPlan` or `world.place`. Call `desk.propose`. If desk module not ready, return `{ ok:false, error:"Circuit Desk not mounted" }`.
- `get_world_state`: add `revision: world.revision`. If desk is open, add `anchor` and `layerY`.
- Keep `run_build_plan` wired to `runPlan`.
- `registerPlaySpaceTools(world, { signal, modelContext, desk })` — pass `desk` from `main.js`. Do not register `set_blocks`.

**Verify**: `rg "propose_world_edit" MINECRAFT_3D/js/ai.js MINECRAFT_3D/js/main.js` matches. `rg "run_build_plan" MINECRAFT_3D/js/ai.js` still matches.

### Step 7: Tests + vitest glob

`vite.config.ts` `test.include` becomes:

```ts
include: ["src/**/*.test.ts", "src/**/*.test.tsx", "MINECRAFT_3D/js/**/*.test.js"],
```

`MINECRAFT_3D/js/circuit-desk.test.js` (model after `two-bit-adder.test.js`):

- parse `place lever +1 0 0` with anchor `{0,0,0}` → action place lever at 1,0,0
- reject `place cheese +0 0 0`
- reject malformed `place lever`
- `applyDraft` fake world: one invalid action among two → `applied === 0` and `place` never called
- stale `expectedRevision` → no mutation
- grid helper and parser produce equal actions for the same cell

`two-bit-adder.test.js` will now be collected. **Verify it still passes.** If it fails because Vitest cannot import the file, STOP and report (do not rewrite the adder).

**Verify**: `npm test` all pass. `npm run typecheck` exit 0.

## Test plan

- New: `MINECRAFT_3D/js/circuit-desk.test.js` as listed in step 7.
- Pattern: `MINECRAFT_3D/js/two-bit-adder.test.js`.
- Existing Arena tests must still pass (no `src/` behavior change intended).
- Human (required for HUD): load Play Space → Play → aim → **B** → place two cells on Y=0 and Y=1 via grid → ghosts → Apply → blocks match. Type `place lever +1 0 0` → same as clicking that cell. Propose via tool if WebMCP is available; otherwise skip and note it. Confirm **E** still opens Inventory and `run_build_plan` still places immediately if you invoke it.

## Done criteria

- [ ] `docs/purpose_builder.md` matches the canonical brief (Play Space, both tools, no `supports`)
- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0 including `circuit-desk.test.js` (and newly included `two-bit-adder.test.js`)
- [ ] `rg "propose_world_edit" MINECRAFT_3D/js/ai.js` matches
- [ ] `rg "run_build_plan" MINECRAFT_3D/js/ai.js` matches (kept)
- [ ] `rg "KeyB" MINECRAFT_3D/js/main.js` matches
- [ ] `applyDraft` exists; `runPlan` still continues on per-action errors
- [ ] No `src/ui` or `src/webmcp` files in `git status` except if you had to touch `vite.config.ts` only
- [ ] `plans/README.md` row 004 updated

## STOP conditions

Stop and report (do not improvise) if:

- You think the desk belongs on the Arena page.
- You need to delete `run_build_plan` to “make Apply the only path.”
- Occupancy walking for rotate-on-draft-place is unclear after one attempt — report instead of a third interpreter.
- Pointer lock makes the desk unusable after two tries to `unlock()` (same class of bug as Inventory).
- Vite pulls `three.module.js` into the React bundle or OOMs.
- `two-bit-adder.test.js` fails for a reason other than the glob change (report the error).

## Maintenance notes

- Reviewer: confirm `propose_world_edit` cannot place; confirm `run_build_plan` still can. That dual path is intentional.
- If partial `runPlan` becomes a problem, that is a **new** plan (option C from the review), not a silent fix here.
- Arena `set_blocks` remains the agent path for `/`. Do not unify the two JSON shapes in this plan.
- 11×11 is a window. Large calculators are typed or proposed with absolute coords, then Apply.
