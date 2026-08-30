---
name: verify-build-arena
description: Drive the Build Arena web UI in a browser the way a user does — load the workspace, palette, camera, sidebar, and JSON blueprint apply. Use when proving a UI change, after arena editor work, or before claiming a Build Arena feature works.
---

# Verify Build Arena

Build Arena is a Vite + React + Three.js voxel blueprint editor. The user-facing surface is the single-page web UI at `/` (title `Build Arena`). Unit tests in Vitest do not prove this path. WebMCP tools exist for agent edits in Cursor; this skill proves the **human UI**, not those tools.

Never drive a server you did not start. The daily `npm run dev` default is port **5173**. Verification uses **4173** only.

## Launch

From the repo root:

```bash
scripts/launch
```

That runs `node_modules/.bin/vite --host 127.0.0.1 --port 4173 --strictPort` (same as `npm run dev`, but the pidfile is the listener, not the npm wrapper), writes `/tmp/verify-build-arena.pid` and `/tmp/verify-build-arena.log`, and waits until `http://127.0.0.1:4173/` returns HTML containing `<title>Build Arena</title>`.

Ready for driving is stricter than HTTP-up:

1. `launch` succeeded (or `doctor` is green).
2. Open `http://127.0.0.1:4173/` in the Cursor browser tools (`browser_navigate`, then `browser_lock`).
3. Wait until the `Loading space` progressbar is gone (first WebGL frame + ≥600ms, then fade). Poll with `browser_snapshot` or CDP `document.querySelector('[aria-label="Loading space"]') === null`. Give up after 8s and run Doctor.

Teardown is **Cleanup**, not closing the tab.

Two instances can run on different ports. Do not start a second verify server on 4173 (`--strictPort` fails if occupied). In-memory arena state is per page load. `localStorage` key `build-arena.sidebarCollapsed` is origin-scoped (`127.0.0.1:4173`), so it does not collide with a 5173 session.

## Doctor

Read-only. Run before driving if anything looks off:

```bash
scripts/doctor
```

Require all of:

- PID in `/tmp/verify-build-arena.pid` is alive and owns TCP listen on `127.0.0.1:4173` (or `*:4173`).
- `GET http://127.0.0.1:4173/` is HTTP 200 and the body includes `<title>Build Arena</title>`.
- After load, snapshot shows heading `Build Arena`, Workspace tab `Build Arena` with `aria-current="page"`, and no `Loading space` progressbar.

Refuse to drive if Doctor fails, if the URL is not `http://127.0.0.1:4173/`, or if the PID file is missing (that is someone else's server).

## Drive

Harness: Cursor `cursor-ide-browser` tools. Order: `browser_navigate` → `browser_lock` → snapshot → clicks/fills → screenshot → `browser_lock` unlock when finished with the browser.

Stable handles (prefer these over canvas coordinates):

| Control | Handle |
|---|---|
| Product tab | button `Build Arena` (`aria-current="page"`) |
| Export | button `Export` |
| Undo / Redo | `aria-label` `Undo` / `Redo` |
| Sidebar toggle | `aria-label` `Collapse editor sidebar` or `Expand editor sidebar` |
| Camera | toolbar `Camera views`; buttons `Isometric`, `Top`, `Front`, `Right` (`aria-pressed`) |
| Palette | `aria-label` `Select <label>` (`Dirt`, `Stone`, `Oak log`, `Oak planks`, `Leaves`, `Glass`, `Obsidian`); selected has `aria-pressed=true` and visible `Selected` |
| Sidebar tabs | `Layers`, `Activity`, `Slider` (`aria-pressed`) |
| JSON entry | Activity panel button `Edit` |
| JSON field | textbox `Blueprint JSON` |
| JSON apply | button `Validate and apply` |
| JSON back | button `Back` |
| Status | `role=status` live region under the viewport |
| Layers empty | text `No layers yet` |
| Activity | heading `Agent activity`; rows include actor, name (`place`, `json.apply`, `export`, …), `ok`/`fail`, revision |
| Dimensions | sliders `Platform width` and `Build height` |

The 3D canvas (`.renderer-host`) has no ARIA cell handles. Click-to-place / right-click-remove is not a reliable agent path. Prove occupancy via JSON apply + Activity/JSON preview, not canvas picking.

Read the feature map before a run: [features/README.md](features/README.md). Drive one mapped feature per proof unless the task names more.

## Evidence

Save under `.cursor/skills/verify-build-arena/artifacts/<feature-id>/`. Keep these after Cleanup.

Proof standards:

- Exercise the real control (button, tab, textarea), not Zustand setters or Vitest.
- Capture the action and the resulting state: ARIA snapshot **and** screenshot with the `Build Arena` chrome visible.
- For mutations, a second user-facing view must show the change (Activity `json.apply` `ok` **and** JSON preview containing the placed block). Status text alone is not enough.
- Record feature ID and URL `http://127.0.0.1:4173/` with the artifacts.
- WebMCP / `document.modelContext` is out of scope unless the feature file says otherwise.

Suggested files per feature: `after.aria.txt` (paste `browser_snapshot` YAML) and `after.png` (`browser_take_screenshot`). Copy the screenshot into the artifacts folder if the tool writes elsewhere.

## Cleanup

```bash
scripts/cleanup
```

Kills only the PID in `/tmp/verify-build-arena.pid`, then removes the pid file. Does not delete `artifacts/`. Does not `pkill vite` or kill by process name. Leave the Cursor browser tab; unlocking is enough.

## Helpers

These live in repo-root `scripts/` (not under the skill folder). They are executable; invoke from repo root as shown.

- `scripts/launch` — start the verify Vite server on 4173.
- `scripts/doctor` — print `ok` or a one-line failure and exit non-zero.
- `scripts/cleanup` — stop the verify server started by `launch`.
