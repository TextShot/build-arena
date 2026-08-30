# Editor sidebar

Editor sidebar lets a user inspect layers, agent activity, arena dimensions, and collapse the panel to enlarge the viewport.

## Sub-features

- `sidebar-layers` shows the Layers panel empty state on a fresh arena.
- `sidebar-activity` shows the Agent activity feed and JSON preview.
- `sidebar-slider` shows Platform width and Build height sliders.
- `sidebar-collapse` hides the sidebar and offers Expand.
- `sidebar-expand` brings the sidebar back.

## How to get to it (user POV)

- Use the `Editor panels` tabs `Layers`, `Activity`, and `Slider`.
- Use the top-bar control `Collapse editor sidebar` / `Expand editor sidebar`, or press `]` when not typing in a field.

## Driving it with cursor-ide-browser

Preconditions:

- Workspace load is complete.
- JSON editor mode is off (no `Validate and apply` on screen). If it is on, choose `Back`.

- **Layers.** Choose Layers if it is not pressed. Run `browser_click` on button `Layers`. Heading `Layers` and text `No layers yet` are visible.
- **Activity.** Choose Activity. Run `browser_click` on button `Activity`. Heading `Agent activity` is visible, a row named `arena.ready` is `ok`, and a JSON heading with `Edit` is visible.
- **Slider.** Choose Slider. Run `browser_click` on button `Slider`. Sliders named `Platform width` and `Build height` are visible.
- **Collapse.** Choose Collapse editor sidebar. Run `browser_click` on the button named `Collapse editor sidebar`. The Layers/Activity/Slider tabs are gone. The same control is now named `Expand editor sidebar`.
- **Expand.** Choose Expand editor sidebar. Run `browser_click` on `Expand editor sidebar`. The editor panels return.
- **Proof.** Save snapshot and screenshot under `artifacts/editor-sidebar/` showing either a named panel or the collapsed chrome with `Expand editor sidebar`.

## Gotchas

- Collapse state is stored in this origin's `localStorage`. A leftover collapsed sidebar on 4173 is still this verify instance; expand it rather than switching ports.
- `]` is ignored while focus is in the JSON textarea.
- Layers stay `No layers yet` for blocks that have no layer id. Occupancy is proven on the JSON feature, not here.
- Do not drag sliders in a baseline proof unless the task is specifically dimension changes; resizing mutates the arena.
