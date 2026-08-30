# Plan 003: Play Space — drop Claude, add WebMCP, place Inventory builds

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 56d47e3..HEAD -- MINECRAFT_3D/index.html MINECRAFT_3D/js/main.js MINECRAFT_3D/js/ai.js MINECRAFT_3D/js/agent.js MINECRAFT_3D/js/world.js MINECRAFT_3D/style.css vite.config.ts`
> Plan 001 will have changed `blocks.js` / `main.js` hotbar. That is expected.
>
> **Prerequisite**: plans 001 and 002 are DONE. Copy `INVENTORY_KEY` and `HANDOFF_KEY` string values from `src/storage/inventory.ts` — do not invent new keys.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: plans/002-blueprint-inventory.md
- **Category**: direction
- **Planned at**: commit `56d47e3`, 2026-08-28

## Why this matters

The Play Space still posts the Anthropic API key from the browser (`ai.js` `askClaude`). Chat is the only agent surface, and it is a second, weaker agent loop than the Arena's WebMCP tools. The user wants that chat gone, the Sandbox kept, and a way to walk a Blueprint they designed in the Arena — same platform size, Play Space textures, ghost-then-click place. This plan is that wiring.

## Current state

- `MINECRAFT_3D/index.html:28-43` — `#chat`, `#apikey`, `#model`, `#settings`. Blocker copy still says "Press T to chat with AI".
- `MINECRAFT_3D/js/main.js:1-6` imports `askClaude, localBrain` from `./ai.js`. Lines 68-130 are chat send / `applyWithRetry`. `chatOpen` also gates pointer lock and hotbar keys.
- `MINECRAFT_3D/js/ai.js` — `SYSTEM_PROMPT`, `askClaude` (browser `fetch` to `api.anthropic.com` with `x-api-key`), `localBrain`. **Do not delete this file.** Replace its exports.
- `MINECRAFT_3D/js/agent.js` — `runPlan`, `worldSnapshot`, `extractPlan`. `BOUND = 32`, `MAX_ACTIONS = 200`. `runPlan` applies valid actions and **continues** on errors (partial apply). Keep that behavior; do not make it atomic unless a test demands it.
- `MINECRAFT_3D/js/world.js:37` — `this._terrain(28)`. `_terrain(n)` uses `h = n/2` and `for (let x=-h;x<h;x++)`. That only works for **even** `n`. Arena `platformSize` is always odd (51 default). **You must rewrite `_terrain` to integer inclusive bounds**, not pass 51 into the current loop.
- Grass instances sit at `y = -1`. Arena first buildable is `y = 1`. Transplant uses `worldY = arenaY - 1`.
- Facing: Arena `north|east|south|west` → Play Space `N|E|S|W`.
- `src/ui/SpaceLoadOverlay.tsx` + `src/ui/space-load.ts` — timings: start 13%, mid 66% at 500ms, done when ready && ≥600ms, fallback 4s. Port the numbers, not the React component.
- `src/webmcp/register-arena-tools.ts` — feature-detect `document.modelContext`, `AbortController`, `registerTool`. Copy that lifecycle. Arena tools **unregister on navigation** (page unmount). Play Space must register its own tools.
- Vite has no second HTML input. `npm run build` would drop the Play Space from `dist/`.

WebMCP skill rules (`.agents/skills/webmcp-build-arena/SKILL.md`): snake_case names, `additionalProperties: false`, reads get `readOnlyHint: true`, no eval, feature-detect, abort on teardown. `run_build_plan` goes through `runPlan`. `clear_world` and `place_blueprint_from_inventory` call World methods directly (step 6).

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npm run typecheck`| exit 0              |
| Tests     | `npm test`         | all pass            |
| Dev serve | `npm run dev`      | both `/` and `/MINECRAFT_3D/index.html` load |

There is no `npm run lint`.

## Suggested executor toolkit

- `.agents/skills/webmcp-build-arena/SKILL.md`
- `.agents/skills/webmcp-build-arena/references/agentic-javascript-tools.md`
- `.cursor/skills/verify-build-arena/SKILL.md` (launch on 4173, then also open the Play Space URL)
- Do not read `MINECRAFT_3D/vendor/three.module.js` in full.

## Scope

**In scope**:
- `MINECRAFT_3D/index.html`
- `MINECRAFT_3D/style.css`
- `MINECRAFT_3D/js/main.js`
- `MINECRAFT_3D/js/ai.js` (rewrite exports; keep filename)
- `MINECRAFT_3D/js/agent.js` (`validate` reads `world.radius`; y cap `31`)
- `MINECRAFT_3D/js/world.js` (`_terrain` odd-size rewrite; `onFrame` hook for ghost)
- `MINECRAFT_3D/js/inventory.js` (create — vanilla reader)
- `MINECRAFT_3D/js/placement.js` (create — ghost + commit; duplicates the 15-line map)
- `src/storage/transplant.ts` (create — the map + Vitest)
- `src/storage/transplant.test.ts` (create)
- `vite.config.ts` (merge second HTML input + `optimizeDeps.exclude`; keep existing imports)
- A "Build Arena" control on the Play Space HUD that `location.assign("/")`

**Out of scope**:
- Arena React files except if a constant is wrong — then STOP and fix in 002, do not fork keys.
- Deleting `ai.js`.
- Anthropic, fetch to `api.anthropic.com`, `#apikey`.
- Porting redstone `simulate` into the Arena.
- Expanding the Play Space hotbar beyond `HOTBAR_IDS` + the 3-dot slot.
- GitHub Pages workflow under `MINECRAFT_3D/.github/`.

## Git workflow

- Stay on the current branch.
- One commit: `Open Play Space from Inventory without the Claude chat`.
- Do not push.

## Steps

### Step 1: Vite must serve and build the Play Space

In `vite.config.ts` **merge** into the existing `defineConfig`. Keep `import { defineConfig } from "vitest/config"` and `import react from "@vitejs/plugin-react"`. Add:

```ts
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));
```

Inside the existing config object, add `optimizeDeps` and `build.rollupOptions.input` (two keys: existing `index.html` as `main`, plus `playSpace: resolve(root, "MINECRAFT_3D/index.html")`). Do not delete `plugins` or `test`.

`optimizeDeps.exclude` is a belt-and-suspenders string. The Play Space must keep importing `../vendor/three.module.js` relative — never import it from `src/`. If Vite still tries to parse that 53k-line file as part of the React app, STOP.

**Verify**: `npm run dev` (briefly) — `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173/MINECRAFT_3D/index.html` prints `200`. Stop the server when done.

### Step 2: Strip chat DOM and Claude

`index.html`:

- Delete `#chat` and `#settings`.
- Add `#space-load` overlay markup (bar + `aria-label="Loading space"`) copied from the Arena overlay's accessible name so verify-skill polling still makes sense.
- Add `#inventory-overlay` hidden by default.
- Add a HUD button `#to-arena` labeled `Build Arena`.
- Rewrite blocker help: drop "Press T to chat with AI". Mention `⋯` opens Inventory, Esc cancels placement.

`main.js`: delete `askClaude` / `localBrain` imports, `history`, `openChat`, `send`, `applyWithRetry`, `chatOpen`. Pointer-lock and hotbar keys should no longer check `chatOpen`. **Do not leave a dead `T` key handler.**

`ai.js`: delete `askClaude` and `localBrain`. Keep the prompt text but **edit three facts** so the tool description is true: ground grass is `y = -1`; first empty cell on grass is `y = 0`; coordinate bound is the current `world.radius` (not ±32); available ids are `BLOCK_IDS` (whole Catalogue). Export it as `WORLD_RULES`. Add `export async function registerPlaySpaceTools(world, { signal, modelContext })` — implemented in step 6; until then the body is `return false`. `main.js` will `await` it.

**Verify**: `rg "api.anthropic.com|askClaude|#apikey" MINECRAFT_3D` → no matches except maybe README. If README still documents the key, leave README (docs are stale-adjacent); do not spend time rewriting it unless a sentence still tells users to paste a key in the HUD.

### Step 3: Odd, locked terrain from Handoff

Rewrite `World._terrain(platformSize)`:

```js
_terrain(platformSize) {
  const radius = (platformSize - 1) / 2;
  this.platformSize = platformSize;
  this.radius = radius;
  const count = platformSize * platformSize;
  const grass = new THREE.InstancedMesh(this.cube, faceMaterials('grass'), count);
  const m = new THREE.Matrix4();
  let i = 0;
  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      m.setPosition(x, -1, z);
      grass.setMatrixAt(i++, m);
    }
  }
  // dirt box width/depth = platformSize, same as before (height 6, y = -4.5)
}
```

Reject even `platformSize` (log + fall back to 51). Call `_terrain` from `main.js` **after** reading Handoff, not from the constructor with a hardcoded 28. Easiest: change `World` constructor to `constructor(canvas, platformSize)` and pass the resolved size.

`agent.js`: delete `const BOUND = 32`. `validate(a, world)` uses `world.radius` for **x and z**. For **y**, reject if `a.y < 0` or `a.y > 31` (`MAX_BUILD_HEIGHT` from the Arena). `runPlan` must pass `world` into `validate`. Do not add a slider.

**Verify**: a node-less sanity check — `rg "_terrain\\(28\\)" MINECRAFT_3D/js` → no matches.

### Step 4: Vanilla Inventory reader + loading overlay + 3-dot

Create `MINECRAFT_3D/js/inventory.js`:

```js
export const INVENTORY_KEY = "build-arena.inventory.v1";
export const HANDOFF_KEY = "build-arena.handoff.v1";
```

`readInventory()`, `readAndClearHandoff()` — same JSON shape as plan 002. The Play Space overlay is **read + place only**. Do not wire Delete here (Arena overlay already deletes).

`main.js` boot:

1. `handoff = readAndClearHandoff()`
2. `platformSize = handoff?.platformSize ?? 51`. Accept only odd integers from 7 to 101 (the Arena slider range). Otherwise 51.
3. `new World(canvas, platformSize)`
4. Show `#space-load` until first `renderer.render` in `_loop`, using the same 13 / 66 / 500 / 600 / 4000 numbers as `src/ui/space-load.ts`. Duplicate the math in `main.js`. Accessible name `Loading space`.

Add `world.onFrame = null` (or a small listener list). At the start of `_update`, call it if set. Placement uses this to move the ghost. Do not rewrite `_loop`.

Hotbar: after `HOTBAR_IDS` slots, append a `.slot.inventory-slot` labeled `⋯`, `aria-label="Open inventory"`. Click toggles overlay and `world.unlock()`. **The 3-dot is not a selectable index.** `selected` stays `0..HOTBAR_IDS.length-1`. Digit keys, wheel, and `world.place(..., HOTBAR_IDS[selected])` must never see index 10. Attach the click handler on the 3-dot node only; do not put it in `selectSlot`.

`#to-arena` → `location.assign("/")`.

**Verify**: overlay markup exists in `index.html`. `rg "INVENTORY_KEY" MINECRAFT_3D/js/inventory.js src/storage/inventory.ts` shows identical string.

### Step 5: Transplant + ghost placement

Create `MINECRAFT_3D/js/placement.js`.

```js
export const ARENA_TO_WORLD_FACING = { north: "N", east: "E", south: "S", west: "W" };

export function arenaBlockToPlaceOpts(block) {
  const facing = block.state?.facing ? ARENA_TO_WORLD_FACING[block.state.facing] : undefined;
  const mode = block.state?.mode;
  return { facing, mode };
}

export function worldCoord(block, origin) {
  return {
    x: origin.x + block.x,
    y: block.y - 1,
    z: origin.z + block.z,
  };
}
```

Live `pickCenter()` returns `placeAt` as `[x, y, z]`, not an object (`world.js` ~257–263). Convert every time:

```js
function originFromPick(pick) {
  const p = pick.placeAt;
  return { x: p[0], y: p[1], z: p[2] };
}
```

`worldCoord` uses that object.

Ghost: a `THREE.Group` of translucent cubes at the relative offsets. `world.onFrame` moves the group to `originFromPick(world.pickCenter())` while placement is active and a pick exists. Do not call `world.place` on mousemove.

Click commit: ignore the **first** `mousedown` after entering placement if it is the same event that acquired pointer lock (the blocker click). After that, next right-click or left-click on a valid pick commits. Esc cancels and removes the ghost, and restores normal break/place.

If Handoff `kind === "place"` and `blocks.length > 0`, set `pendingPlacement = blocks` on boot. After `controls` fires `lock` the first time, enter placement mode (ghost on). Do not commit on that lock click.

For each block on commit: `const c = worldCoord(block, origin); world.place(c.x, c.y, c.z, block.block, arenaBlockToPlaceOpts(block))`. Skip if `|c.x| > world.radius` or `|c.z| > world.radius` or `c.y < 0` or `c.y > 31`.

Put `arenaBlockToPlaceOpts` and `worldCoord` in `src/storage/transplant.ts` and test them. Copy the same two functions into `placement.js` with the comment `// keep in sync with src/storage/transplant.ts`. Do not import `src/` from `MINECRAFT_3D/js`.

### Step 6: WebMCP tools in `ai.js`

`export async function registerPlaySpaceTools(world, { signal, modelContext } = {})` matching `register-arena-tools.ts`: feature-detect, optional `modelContext` injection for tests, `await registerTool`, return boolean.

| Tool | Kind | Behavior |
|------|------|----------|
| `get_world_state` | read | `{ snapshot: worldSnapshot(world), platformSize: world.platformSize, radius: world.radius }`. `readOnlyHint: true` |
| `run_build_plan` | write | input `{ explain?: string, actions: [{op, block?, x,y,z, facing?, mode?}] }`. Pass to `runPlan`. Return `{ ok, applied, errors }`. Description starts with `WORLD_RULES`. |
| `clear_world` | write | `world.clear()`. Allowed to call the World API directly (not an `op` in `runPlan`). |
| `place_blueprint_from_inventory` | write | input `{ id: string, origin: {x,y,z} }`. Look up Inventory, then the same loop as click-commit (`world.place` per block). Allowed to call `world.place` directly — do not wrap each block in `runPlan` (would hit `MAX_ACTIONS` on large houses). |

`run_build_plan` is the Sandbox path. The other two writes are explicit World APIs, not a bypass of the whitelist: `place` still no-ops unknown ids.

Schemas: JSON Schema objects, `additionalProperties: false`, integer coords, `maxItems: 200` on actions, enum of Catalogue ids from `BLOCK_IDS`.

`main.js` on boot: `const c = new AbortController(); await registerPlaySpaceTools(world, { signal: c.signal });` Feature-detect; missing API → `false`, game still runs.

Do not register Arena tool names (`set_blocks`, …) on this page.

**Verify**: no `fetch(` left in `MINECRAFT_3D/js/ai.js`. `rg "registerPlaySpaceTools" MINECRAFT_3D/js/main.js` matches.

### Step 7: Tests + typecheck + human loop

- `src/storage/transplant.test.ts`: `(2,1,5)` relative + origin `(0,0,0)` → world `(2,0,5)`; facing `west` → `W`.
- `npm run typecheck` and `npm test`.

Human (required; this is a UI change): follow `.cursor/skills/verify-build-arena/SKILL.md` launch on **4173**, then:

1. Place a few Phase A cubes and one repeater in the Arena.
2. Add to inventory — thumbnail appears in the overlay.
3. Open in 3D — loading overlay shows, terrain width matches the Arena slider value, ghost appears, click places, oak/stone use Play Space textures (PNG or color), repeater faces the stored direction.
4. Minecraft tab visit (no blocks) loads an empty Play Space of that size.
5. Confirm `#apikey` and chat textarea are gone.
6. 3-dot on the Play Space hotbar reopens Inventory.

If browser tools are unavailable, say so and record which steps you could not click.

## Test plan

- `src/storage/transplant.test.ts` as above.
- Existing Arena tests still pass (no engine behavior change intended).
- No Vitest for `ai.js` unless you add a tiny node test by exporting `arenaBlockToPlaceOpts` from TS only.

Verification: `npm test` → all pass.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0
- [ ] `rg "api.anthropic.com|askClaude|localBrain" MINECRAFT_3D/js` returns no matches
- [ ] `ai.js` still exists and exports `registerPlaySpaceTools`
- [ ] `_terrain` uses inclusive integer radius; no `_terrain(28)`
- [ ] `INVENTORY_KEY` / `HANDOFF_KEY` strings match `src/storage/inventory.ts`
- [ ] Hotbar is `HOTBAR_IDS` (10) + 3-dot
- [ ] `vite.config.ts` lists `MINECRAFT_3D/index.html` as an input
- [ ] Browser loop above, or an explicit note of what was not clicked
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Vite pulls `MINECRAFT_3D/vendor/three.module.js` into the React bundle or OOMs while optimizing it.
- `_terrain` with odd size leaves a hole or off-by-one vs Arena radius `(platformSize-1)/2`.
- Handoff keys diverge from 002.
- Pointer lock makes Inventory clicks impossible after two attempts to `unlock()` — stop and report the event-order you saw.
- You think the fix is to iframe the Play Space inside `BuildArenaPage`.
- `runPlan` whitelist rejects Arena ids (001 did not export them on `BLOCKS`) — go back to 001, do not widen the whitelist with string literals here.

## Maintenance notes

- Reviewer: confirm no API key field remains in the HUD; confirm transplant Y is `arenaY - 1`; confirm agent bound tracks platform radius.
- Future: a redstone computer is built with `run_build_plan` while the user walks the Play Space — keep `MAX_ACTIONS = 200` unless a later plan raises it with evidence.
- If Arena `MAX_PLATFORM_SIZE` (101) makes grass InstancedMesh heavy, cap later; do not cap in this plan (user asked sizes equal and locked).
