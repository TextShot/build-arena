# Build Arena verification map

This directory is the maintained source for verifying the user-facing behavior of Build Arena. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch with `scripts/launch` so the app is at `http://127.0.0.1:4173/`.
- Run `scripts/doctor` and require `doctor ok` for that URL and pidfile.
- Open that URL in Cursor browser tools. Wait until `Loading space` is gone.
- Never drive port 5173 or any instance not started by `launch`.
- Start every recipe from a fresh load of `/` unless the feature lists extra preconditions.

## Driving conventions

- Prefer accessible names (`Select Dirt`, `Isometric`, `Validate and apply`) over CSS or canvas hits.
- Treat every control name as literal.
- Drive through `cursor-ide-browser`: navigate, lock, snapshot, click/fill, screenshot, unlock.
- Do not prove placement by clicking the WebGL canvas.
- Restore nothing in localStorage except by reloading after cleanup of the verify server. Do not delete proof artifacts.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot with Build Arena identity visible (heading/tab `Build Arena`).
- Mutation proof includes a second user-facing view (Activity row and JSON preview).
- Record the feature ID and `http://127.0.0.1:4173/` with every artifact.
- Report an unreachable path with the attempted control and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with cursor-ide-browser` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Load the workspace](./workspace-load.md) covers the loading overlay dismissing and the editor chrome appearing.
- [Block palette](./block-palette.md) covers selecting a palette block and seeing the selected mark move.
- [Camera views](./camera-views.md) covers Isometric, Top, Front, and Right presets.
- [Editor sidebar](./editor-sidebar.md) covers Layers, Activity, Slider, and collapse/expand.
- [JSON blueprint](./json-blueprint.md) covers editing JSON, rejecting invalid JSON, and applying a dirt block.
