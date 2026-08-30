# Camera views

Camera views let a user switch the 3D viewport among Isometric, Top, Front, and Right presets without changing the build.

## Sub-features

- `camera-default` starts with Isometric pressed.
- `camera-top` selects Top.
- `camera-front` selects Front.
- `camera-right` selects Right.
- `camera-iso` returns to Isometric.

## How to get to it (user POV)

- Use the `Camera views` toolbar above the viewport.

## Driving it with cursor-ide-browser

Preconditions:

- Workspace load is complete.

- **Default.** Snapshot the toolbar. Run `browser_snapshot`. `Isometric` has `aria-pressed=true`.
- **Top.** Choose Top. Run `browser_click` on button `Top`. `Top` is pressed; `Isometric` is not.
- **Front.** Choose Front. Run `browser_click` on button `Front`. `Front` is pressed.
- **Right.** Choose Right. Run `browser_click` on button `Right`. `Right` is pressed.
- **Isometric.** Choose Isometric. Run `browser_click` on button `Isometric`. `Isometric` is pressed again.
- **Proof.** Save a snapshot and screenshot under `artifacts/camera-views/` with a non-default preset pressed and the viewport still showing the arena grid.

## Gotchas

- Pressed state is the accessible proof. A screenshot of the canvas without `aria-pressed` is incomplete.
- These buttons do not place or delete blocks.
- `Isometric` is the label; the stored preset id `iso` never appears in the UI.
