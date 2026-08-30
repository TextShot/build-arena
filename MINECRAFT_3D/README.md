# Redstone World · Play Space

The Play Space is the first-person Three.js side of Build Arena. Build in the visual Arena, save or hand off the build, then open it here to walk through it and use the redstone simulation.

Build Arena and the Play Space share browser Inventory and handoff data. Build Arena's redstone blocks are visual-only; signal simulation runs only in the Play Space.

## Run locally

Run the Vite project from the repository root:

```bash
npm install
npm run dev
```

- Build Arena: `http://localhost:5173/`
- Play Space: `http://localhost:5173/MINECRAFT_3D/index.html`

Do not open `index.html` directly. Vite resolves the module graph, block textures, shared assets, and deployment base path.

## GitHub Pages

The Pages workflow builds both Vite entry points:

- Build Arena: `https://<owner>.github.io/<repo>/`
- Play Space: `https://<owner>.github.io/<repo>/MINECRAFT_3D/index.html`

CI sets `GITHUB_PAGES=true`; `vite.config.ts` derives the project-site base from `GITHUB_REPOSITORY`.

## Controls

| Action | Input |
|---|---|
| Enter the world / capture mouse | Click the screen |
| Move | `W` `A` `S` `D` |
| Ascend / descend | `Space` / `Left Shift` |
| Look | Mouse with Pointer Lock; arrows in fallback mode |
| Fallback drag look | `Alt` + left drag |
| Place selected block | Left click empty space |
| Remove targeted block | Right click |
| Use lever or button | Left click |
| Rotate repeater/comparator | Left click |
| Change comparator mode | `Shift` + left click |
| Select hotbar slots | `1`–`9`, `0`, or mouse wheel |
| Select Oak Sign | `B` |
| Open Inventory | `E` or hotbar `⋯` |
| Pause / cancel | `Esc` |
| Undo / redo | `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` |
| Toggle Build Lock | `L` |
| Mute / unmute music | `M` |

When Pointer Lock is unavailable, the world activates fallback controls and shows an instruction to use arrow keys or switch to Chrome.

## Build Lock

`L` protects the structure from accidental manual edits. While locked, manual placement, removal, device rotation, comparator-mode changes, Inventory placement, undo, and redo are blocked. Movement, camera controls, UI, levers, buttons, and Sign editing remain available. Play Space WebMCP tools are not gated by this manual lock.

Build Arena has a separate WebMCP manual-edit lock for coordinating Arena tool writes.

## Oak Signs

Press `B` to select the Oak Sign. Placing a Sign opens its editor; clicking an existing Sign reopens it whether Build Lock is on or off.

- Front text only
- Up to 18 columns across four wrapped lines
- `Done` saves
- `Esc` cancels

Agent plans cannot place Oak Signs; Signs remain a player-facing interaction.

## Inventory and handoff

Build Arena stores up to 20 saved builds in browser `localStorage`. Entries retain blocks, block states, dimensions, and thumbnails.

`Open in 3D World` writes a one-shot handoff and navigates to the Play Space. The Play Space reads and clears that handoff. Choosing an Inventory build shows a placement preview; left click commits it and `Esc` cancels.

## WebMCP

Tools register only when the browser host provides `document.modelContext.registerTool`. No API key or chat window is used.

Play Space tools:

- `get_world_state`
- `run_build_plan`
- `clear_world`
- `place_blueprint_from_inventory`

`run_build_plan` validates up to 200 immediate `place` / `remove` actions with bounded integer coordinates and returns `{ ok, applied, errors }`. `clear_world` removes placed blocks but preserves terrain. `place_blueprint_from_inventory` takes an Inventory id and integer origin and may return partial `{ ok, applied, skipped }` results.

The agent prompt is redstone-focused, while the runtime sandbox allows only whitelisted block ids and bounded `place` / `remove` operations. The Build Arena route exposes its own revisioned query, lock, shape, transform, block-edit, undo, and camera-view tools; Arena mutations require its separate revision-aware manual lock.

Recommended Arena flow:

```text
lock → context → summary → query/slice → write → re-read → unlock
```

## Redstone scope

This is a focused simulation, not full vanilla Minecraft.

- Active sources output signal strength 15; levers and buttons can be off, and torches extinguish when their support block is powered.
- Lever state persists; buttons pulse for about one second.
- Redstone wire loses one signal level per block.
- Torches invert power from their support block.
- Repeaters are directional and boost output to 15.
- Comparators support compare and subtract modes.
- Lamps react to simulated power.
- Solid blocks participate in the simplified propagation model.
- Piston pushing and extension are not implemented.

## Project structure

```text
MINECRAFT_3D/
├── index.html          # Play Space entry and static startup recovery UI
├── style.css           # HUD, menus, loading, and Sign editor
├── js/
│   ├── main.js         # UI, input, Inventory, history, tool registration
│   ├── world.js        # Three.js world, interaction, redstone visuals
│   ├── blocks.js       # Block catalogue and signal simulation
│   ├── textures.js     # Vite-managed textures and hotbar icons
│   ├── placement.js    # Inventory placement preview and commit
│   ├── edit-history.js # Session undo/redo and conflict checks
│   ├── inventory.js    # Shared Inventory/handoff reads
│   └── ai.js           # Play Space WebMCP tools
└── vendor/             # Local Three.js r160 and PointerLockControls
```

## Credits and license

The first-person world began from [maoxin1234/redstone-world](https://github.com/maoxin1234/redstone-world) under MIT. Music is ansimuz, “Going Up”; see `public/public-license.txt`. See [`LICENSE`](LICENSE). Repository-level credits and third-party asset licenses are documented in the root README and public license files.
