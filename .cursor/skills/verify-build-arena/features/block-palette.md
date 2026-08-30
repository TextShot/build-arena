# Block palette

Block palette lets a user choose which full-cube material the next manual place uses, and see which material is selected.

## Sub-features

- `palette-default` starts with Stone selected.
- `palette-select` moves selection to another Phase A block.
- `palette-restore` can return selection to Stone.

## How to get to it (user POV)

- After the workspace loads, use the block buttons under the 3D viewport (`Dirt`, `Stone`, `Oak log`, `Oak planks`, `Leaves`, `Glass`, `Obsidian`).

## Driving it with cursor-ide-browser

Preconditions:

- Workspace load is complete (`Loading space` gone).
- Sidebar is not covering the palette; default layout is fine.

- **Default selection.** Snapshot the palette. Run `browser_snapshot`. `Select Stone` has `aria-pressed=true` and shows `Selected`. Other palette buttons are not pressed.
- **Select Dirt.** Choose Dirt. Run `browser_click` on the button named `Select Dirt`. `Select Dirt` is pressed and shows `Selected`. `Select Stone` is not pressed.
- **Return to Stone.** Choose Stone. Run `browser_click` on the button named `Select Stone`. `Select Stone` is pressed again.
- **Proof.** Save snapshot and screenshot under `artifacts/block-palette/` showing Dirt or Stone selected with the `Selected` mark visible.

## Gotchas

- Accessible names are `Select Dirt`, not `Dirt` alone.
- Palette selection does not place a block. Do not treat a selected swatch as occupancy proof.
- Water, lava, slabs, and other Phase 6 ids are not in this palette.
