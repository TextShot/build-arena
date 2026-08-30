# Load the workspace

Load the workspace shows Build Arena after the opening space-load bar finishes, with the 3D viewport and editor chrome ready for a user.

## Sub-features

- `load-http` serves the Build Arena page at the verify URL.
- `load-overlay` shows `Loading space` then removes it.
- `load-chrome` shows the product tab, camera toolbar, palette, and sidebar.

## How to get to it (user POV)

- Open `http://127.0.0.1:4173/` in the browser after `scripts/launch`.

## Driving it with cursor-ide-browser

Preconditions:

- `scripts/launch` and `scripts/doctor` succeeded for `http://127.0.0.1:4173/`.
- The browser is not already showing a different origin's Build Arena.

- **Open the app.** Navigate to `http://127.0.0.1:4173/`. Run `browser_navigate` with that URL, then `browser_lock`. The document title is `Build Arena`.
- **Wait out the overlay.** Poll `browser_snapshot` until there is no progressbar named `Loading space`. After at most 8s the overlay is gone.
- **Confirm chrome.** Snapshot shows heading `Build Arena`, Workspace tab `Build Arena` with current page, camera buttons `Isometric` `Top` `Front` `Right`, palette button `Select Stone` pressed, sidebar tab `Layers` pressed, and `No layers yet`.
- **Proof.** Save snapshot YAML to `artifacts/workspace-load/after.aria.txt` and a screenshot to `artifacts/workspace-load/after.png`. Both identify Build Arena with the overlay gone.

## Gotchas

- HTTP 200 is not ready. The overlay can last ~1s after the first frame, or up to 4s on fallback.
- Port 5173 is the everyday Vite port. A green page there is not this verification instance.
- `Minecraft` in the product tabs is disabled. Do not treat it as a reachable workspace.
