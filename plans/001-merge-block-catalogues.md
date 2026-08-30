# Plan 001: Merge the block Catalogue both ways

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 56d47e3..HEAD -- src/core/block-types.ts src/core/blocks.ts src/render/block-mesh-registry.ts src/ui/BlockPalette.tsx src/webmcp/tool-schemas.ts MINECRAFT_3D/js/blocks.js MINECRAFT_3D/js/textures.js MINECRAFT_3D/js/main.js`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `56d47e3`, 2026-08-28

## Why this matters

The Arena and the Play Space currently speak different block languages. A house built from oak in the Arena cannot be placed in the Play Space, and a repeater built in the Play Space cannot even be selected in the Arena palette. This plan makes one Catalogue so a later Inventory transplant is a coordinate mapping, not a material rewrite. Redstone stays unsimulated in the Arena; orientation is stored so a circuit can still run after transplant.

## Current state

- `src/core/block-types.ts` — canonical ids. `PHASE_A_BLOCK_IDS` is the 7-cube palette. `PHASE_6_BLOCK_IDS` is agent-only. `ALL_BLOCK_IDS` is the concat. `normalizeBlockState` only knows slab / stairs / trapdoor. `BlockState` has `facing`, `half`, `open`, `shape` — no comparator `mode`.
- `src/core/blocks.ts` — `BLOCK_CATALOGUE` must stay 1:1 with `ALL_BLOCK_IDS` (`src/core/blocks.test.ts` asserts key order).
- `src/core/arena-contracts.test.ts:29-37` — freezes `PHASE_A_BLOCK_IDS` as the seven cubes. **Do not add redstone to PHASE_A.** Add a new array.
- `src/ui/BlockPalette.tsx:13` — maps `PHASE_A_BLOCK_IDS` only.
- `src/ui/BuildArenaPage.tsx:103-110` — `placeCell` sends `{ action: "place", position, block }` with no `state`. Repeaters will fail `normalizeBlockState` until this helper exists.
- `src/render/block-mesh-registry.ts:22-51` — `BLOCK_MATERIALS` is a `Record<BlockId, …>` and will not typecheck until every new id has a material.
- `src/webmcp/tool-schemas.ts:38-54` — `blockId.enum` is `ALL_BLOCK_IDS` (auto-expands). `blockState` description still says only slab/stairs/trapdoor.
- `src/index.css:451-457` — palette swatches keyed by `data-block`.
- `MINECRAFT_3D/js/blocks.js:4-17` — ten Play Space ids. `BLOCK_IDS = Object.keys(BLOCKS)` drives both hotbar and Sandbox whitelist.
- `MINECRAFT_3D/js/textures.js:13-15` — `loader.load(\`../${name}.png\`)`. PNGs actually live in the oddly named folder `assets /assets/` at repo root (space in the path). From `/MINECRAFT_3D/js/` that `../` URL is `/MINECRAFT_3D/<name>.png`, which does not exist today.
- `MINECRAFT_3D/js/world.js:142-151` — `place` accepts `opts.facing` as `E|W|N|S` and `opts.mode` as `compare|subtract`. Unknown `BLOCKS[id]` returns `false`.
- `MINECRAFT_3D/js/main.js:14-22` — hotbar loops `BLOCK_IDS`. Plan 003 will switch this to `HOTBAR_IDS`; this plan only introduces the constant.

Repo conventions: frozen catalogues, tests next to source (`src/**/*.test.ts`), Vitest + `describe`/`it`/`expect`. Match `src/core/blocks.test.ts`. No `lint` script — use `npm run typecheck` and `npm test`.

Arena facing is `north|east|south|west`. Play Space facing is `N|E|S|W`. Do not change either enum in this plan. Mapping is plan 003.

## Commands you will need

| Purpose   | Command            | Expected on success                          |
|-----------|--------------------|----------------------------------------------|
| Typecheck | `npm run typecheck`| exit 0, no errors                            |
| Tests     | `npm test`         | all pass (including new tests named below)   |

## Suggested executor toolkit

- Do not read `MINECRAFT_3D/vendor/three.module.js` in full.

## Scope

**In scope**:
- `src/core/block-types.ts`
- `src/core/blocks.ts`
- `src/core/blocks.test.ts`
- `src/core/block-types.test.ts` (create)
- `src/ui/BlockPalette.tsx`
- `src/ui/BuildArenaPage.tsx` (`placeCell` default state only; no Inventory UI)
- `src/render/block-mesh-registry.ts`
- `src/webmcp/tool-schemas.ts` (`blockState` description + `mode` property)
- `src/index.css` (new swatches only)
- `MINECRAFT_3D/js/blocks.js`
- `MINECRAFT_3D/js/textures.js`
- `MINECRAFT_3D/js/main.js` (hotbar, digit keys, `selectSlot` length, and `world.place` must all use `HOTBAR_IDS`, not `BLOCK_IDS`)
- PNG copies into `MINECRAFT_3D/` (the files listed in step 5)

**Out of scope**:
- Inventory, thumbnails, Minecraft tab, loading overlay, WebMCP on the Play Space, chat removal (plans 002–003).
- Porting `simulate()` into the Arena.
- Changing `PHASE_A_BLOCK_IDS` contents.
- Changing existing stone/dirt/oak material colors.
- `docs/`, `MY_plan.md`, `.superdesign/`.
- `MINECRAFT_3D/vendor/three.module.js`.
- Secret files (`.env`, `.dev.vars`).

## Git workflow

- Stay on the current branch unless the operator asks otherwise.
- Commit style in this repo is short and informal (`ADDED LOAD BAR`, `added lock and unlock tools`). Prefer one commit at the end of this plan: `Merge Arena and Play Space block catalogues`.
- Do not push.

## Steps

### Step 1: Extend Arena block types

In `src/core/block-types.ts`:

1. Add `REDSTONE_BLOCK_IDS` (nine ids, exact order):
   `redstone_wire`, `redstone_torch`, `redstone_block`, `lever`, `button`, `repeater`, `comparator`, `lamp`, `piston`.
2. Add `PALETTE_BLOCK_IDS = Object.freeze([...PHASE_A_BLOCK_IDS, ...REDSTONE_BLOCK_IDS])`.
3. Append `...REDSTONE_BLOCK_IDS` onto `ALL_BLOCK_IDS` (after Phase 6).
4. Extend `BlockState` with `mode?: "compare" | "subtract"`.
5. Extend `BlockStateKind` with `"repeater" | "comparator"`.
6. In `blockStateKind`: `repeater` → `"repeater"`, `comparator` → `"comparator"`. Lever/button/wire/torch/lamp/piston stay `"none"` (Play Space `place` does not persist facing for those).
7. In `normalizeBlockState`:
   - `repeater`: require `facing` in `FACINGS`; reject other keys; return `{ facing }`.
   - `comparator`: require `facing` and `mode` (`compare` or `subtract`); reject other keys; return `{ facing, mode }`.
8. Add `defaultStateFor(block: BlockId): BlockState | undefined`:
   - repeater → `{ facing: "east" }`
   - comparator → `{ facing: "east", mode: "compare" }`
   - else `undefined`
9. Update `blockStateEquals` to compare `mode`.

**Verify**: `npx vitest run src/core/block-types.test.ts` — file created in step 2; if you run this before step 2, continue.

### Step 2: Tests for state + catalogue

Create `src/core/block-types.test.ts` modeled on `src/core/blocks.test.ts`:

- `defaultStateFor("stone")` is `undefined`.
- `defaultStateFor("repeater")` equals `{ facing: "east" }`.
- `normalizeBlockState("repeater", { facing: "north" })` is ok.
- `normalizeBlockState("repeater", undefined)` fails.
- `normalizeBlockState("comparator", { facing: "west", mode: "subtract" })` is ok.
- `normalizeBlockState("lever", { facing: "east" })` fails (`lever does not support block state`).

Update `src/core/blocks.ts`: add nine catalogue entries. Labels match Play Space `BLOCKS[id].name`. `fullCube` (controls fence/wall connections in the Arena, not mesh height):

| id | fullCube |
|---|---|
| redstone_block, piston | true |
| redstone_wire, redstone_torch, lever, button, repeater, comparator, lamp | false |

Arena meshes: do **not** invent a flattened-box path. `block-mesh-registry.ts` `buildVariantGeometry` already uses a 0.94 cube for any id that is not water/lava/slab/stairs/trapdoor/fence/wall. Leave it. Redstone kit ids will render as that default cube. That is enough.

`src/core/blocks.test.ts` already checks key order vs `ALL_BLOCK_IDS` — it will fail until the catalogue matches. Keep that test; do not weaken it.

**Verify**: `npx vitest run src/core/blocks.test.ts src/core/block-types.test.ts src/core/arena-contracts.test.ts` → all pass. `PHASE_A_BLOCK_IDS` still the original seven.

### Step 3: Materials, palette, place default state, schema copy

- `BLOCK_MATERIALS` in `src/render/block-mesh-registry.ts` — colors from `MINECRAFT_3D/js/blocks.js` (do not restyle existing ids):

  | id | color |
  |---|---|
  | redstone_wire | `0x7a0000` |
  | redstone_torch | `0xff3030` |
  | redstone_block | `0xc01010` |
  | lever | `0x8b5a2b` |
  | button | `0x6b4a1b` |
  | repeater | `0xb0b0b0` |
  | comparator | `0xc8c8c8` |
  | lamp | `0x4a3a10` |
  | piston | `0x9a7a40` |

  Full cubes as boxes is enough. Do not add new geometries for the kit.

- `BlockPalette.tsx`: iterate `PALETTE_BLOCK_IDS` instead of `PHASE_A_BLOCK_IDS`.
- `BuildArenaPage.tsx` `placeCell`: `edits: [{ action: "place", position: coordinate, block, ...(defaultStateFor(block) ? { state: defaultStateFor(block) } : {}) }]`. Call `defaultStateFor` once.
- `tool-schemas.ts` `blockState`: add `mode: { type: "string", enum: ["compare", "subtract"], description: "Comparator mode." }`. Update the description to mention repeater `{facing}` and comparator `{facing, mode}`.
- `src/index.css`: add `.block-choice[data-block="…"] .block-swatch` for the nine ids using the same hex values (6-digit CSS).

**Verify**: `npm run typecheck` → exit 0. `npm test` → all pass.

### Step 4: Play Space catalogue + hotbar freeze

In `MINECRAFT_3D/js/blocks.js`:

- Keep the existing ten entries.
- Add Arena ids that are missing. Each `{ name, color, solid }` using this table (colors = Arena `BLOCK_MATERIALS` hex):

  | id | solid | color |
  |---|---|---|
  | dirt | true | `0x8b5a35` |
  | oak_log | true | `0x7a4e2d` |
  | oak_planks | true | `0xc49355` |
  | leaves | true | `0x4f8a51` |
  | glass | true | `0x9adbe8` |
  | obsidian | true | `0x28243b` |
  | water | false | `0x3f76e4` |
  | lava | false | `0xd45a12` |
  | oak_slab | false | `0xc49355` |
  | oak_stairs | false | `0xc49355` |
  | oak_fence | false | `0xb08046` |
  | stone_wall | false | `0x7d858b` |
  | oak_trapdoor | false | `0xb08046` |

  `solid` here is Play Space redstone conduction, not Arena `fullCube`. Match existing Play Space: `lamp` stays `solid: false` even though it is a cube.
- Do **not** add `grass` as a placeable id (terrain-only).
- Export `HOTBAR_IDS` as the original ten keys, frozen array, same order as today.
- Keep `export const BLOCK_IDS = Object.keys(BLOCKS)` so the Sandbox whitelist includes the whole Catalogue (agents can place oak). `runPlan` already uses `BLOCK_IDS`.

In `MINECRAFT_3D/js/main.js` change the hotbar `forEach` from `BLOCK_IDS` to `HOTBAR_IDS`. Import `HOTBAR_IDS`. Digit keys and `selectSlot` length must use `HOTBAR_IDS.length`, and `world.place(..., HOTBAR_IDS[selected])`.

**Verify**: `rg "HOTBAR_IDS" MINECRAFT_3D/js/main.js` shows the hotbar loop. `rg "BLOCK_IDS.forEach" MINECRAFT_3D/js/main.js` returns no matches.

### Step 5: Textures — copy PNGs and color fallback

Copy these files from `assets /assets/` (literal folder name with a space) into `MINECRAFT_3D/`:

`dirt.png`, `grass_side.png`, `grass_top.png`, `stone.png`, `piston_side.png`, `piston_top.png`, `repeater_side.png`, `repeater_top.png`, `comparator_top.png`, `redstone_block.png`, `lamp_on.png`, `lamp_off.png`.

Do not rename the source folder. Do not commit anything from `.env`.

In `textures.js` `faceMaterials`, keep existing PNG cases **and add**:

- `case 'dirt': res = M('dirt'); break;`
- `case 'grass':` already exists — leave it.

Then replace `case 'stone': default: res = M('stone')` with:

```js
case 'stone': res = M('stone'); break;
default: {
  const color = BLOCKS[id]?.color ?? 0x8a8a8a;
  res = new THREE.MeshStandardMaterial({ color });
  break;
}
```

Import `BLOCKS` from `./blocks.js`. Oak/glass/leaves/etc. have no PNG — they must hit `default`, not stone.png. Dirt has a PNG — it must hit `case 'dirt'`, not `default`. Leave procedural dust / icon sketches as they are.

**Verify**: `ls MINECRAFT_3D/stone.png MINECRAFT_3D/dirt.png MINECRAFT_3D/lamp_off.png` succeeds.

### Step 6: Typecheck and full test

**Verify**: `npm run typecheck` → exit 0. `npm test` → exit 0.

## Test plan

- New `src/core/block-types.test.ts` cases listed in step 2.
- Existing `src/core/blocks.test.ts` remains the catalogue invariant.
- Existing `src/core/arena-contracts.test.ts` still pins Phase A.
- `src/core/blueprint.test.ts` uses partial `toMatchObject` on `blockSummary` — leave it. If `src/storage/blueprint-json.test.ts` v1 fixture lists every Phase A count, leave v1 as Phase A only. If any test does `toEqual` against a full `Record<BlockId, number>`, add zeros for the nine new ids.

Verification: `npm test` → all pass, including the new file.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0
- [ ] `PHASE_A_BLOCK_IDS` is still the original seven (`npx vitest run src/core/arena-contracts.test.ts`)
- [ ] `PALETTE_BLOCK_IDS` has 16 ids (7 + 9)
- [ ] `MINECRAFT_3D/js/main.js` hotbar iterates `HOTBAR_IDS` (10 slots)
- [ ] `placeCell` passes `defaultStateFor(block)` so a repeater place does not fail validation
- [ ] PNG files listed in step 5 exist under `MINECRAFT_3D/`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- Making `BLOCK_MATERIALS` typecheck seems to require rewriting fence/wall connection logic.
- `normalizeBlockState` for Phase 6 blocks starts failing existing `src/core/arena-shapes.test.ts`.
- You believe redstone simulation must land in the Arena for types to compile (it must not).

## Maintenance notes

- Adding another block later: append to the right id array (`PHASE_A` / `PHASE_6` / `REDSTONE`), catalogue, materials, swatch, and Play Space `BLOCKS`. If it belongs on the Play Space hotbar, also append `HOTBAR_IDS`.
- Reviewer: confirm Phase A was not mutated; confirm hotbar is still 10; confirm comparator `mode` is required (not silently defaulted inside `normalizeBlockState` — defaulting belongs in `defaultStateFor` only).
- Follow-up deferred: click-to-rotate in the Arena (R key). Default facing east is enough for this plan; plan 002 can add rotate if the Inventory UI lands. Prefer adding rotate in 002's Arena UI step rather than here.
