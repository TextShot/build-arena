# Build Arena Plan

Status: design baseline before implementation  
Project: Minecraft-inspired Web Build Arena  
Initial scope: Build Arena only  
Future scope: reusable blueprints placed inside a larger voxel game

## 1. Product vision

Create a browser-based voxel Build Arena where a human or an AI agent can construct, inspect, validate, save, and later reuse block builds.

The Build Arena is intentionally simpler than the future game world. It acts like a voxel CAD editor: a controlled workspace with explicit coordinates, predictable building rules, structured commands, strong validation, and useful visual views.

The current flow is:

```text
Human or agent prompt
        |
        v
Build Arena
create + inspect + validate
        |
        v
Blueprint inventory
thumbnail + dimensions + block counts + JSON
        |
        v
Future voxel game
ghost preview + rotate/mirror + place
```



## 2. Confirmed direction

- Build only the Build Arena first.
- Preserve a clean path to a larger Minecraft-inspired voxel game later.
- Use a centred coordinate system.
- Use `(x, y, z)` coordinate order everywhere.
- X and Z are horizontal axes; Y is height.
- The platform is immutable at `y = 0`.
- Use a 7x7 default platform so it has a single centre block at `(0, 0, 0)` and use platform grid : alway oddXodd.
- Use JSON and JSON Schema for structured agent tools and blueprint interchange.
- Also accept compact run-strings such as `oak_planks_1-(x5)` as a write encoding. Parse them into the same command engine; do not bypass validation.
- Use WebMCP so supported browser agents can inspect and modify the live arena.
- Use Zustand now for shared application/UI state because inventory, tabs, and WebMCP interaction are already planned.
- Keep the voxel world and command logic outside Zustand and React.
- Use Three.js.



## 3. Recommended MVP boundaries

These are recommendations, not yet confirmed product decisions:

- Single-player creative building.
- Export/import blueprint JSON before adding automatic browser persistence.
- Support full cube blocks first.
- Treat water and lava as static visual blocks initially; do not implement fluid simulation for now .
- Use original naming, textures, and branding for any public release rather than copied Minecraft assets.
- Prefer odd platform dimensions while using a centre block as the origin.



## 4. Decisions still requiring confirmation

1. Is the product Minecraft-compatible or Minecraft-inspired?
  - Recommendation: Minecraft-inspired.
  - Exact compatibility greatly increases block-state, physics, redstone, fluid, texture, and intellectual-property scope.
2. Must redstone circuits function in the first public version?
  - Recommendation: no. Add a bounded redstone simulator after reliable building is proven.
3. arena dimensions?
  - Recommendation: support odd dimensions first so `(0, 0, 0)` is a real centre block.

### MVP core rulings

- Phase 0–5 uses fixed inclusive bounds: X/Z `-3...+3`, Y `0...6`; buildable Y is `1...6`.
- The 49 platform cells at `y = 0` are implicit protected geometry. They are rendered from `ArenaConfig` and excluded from the mutable sparse world, build queries/counts, history, and blueprint export.
- Phase A blocks have no supported state. Directional/partial block state begins after the full-cube MVP.
- Exact edits only: place requires an empty cell, replace requires an occupied cell, removing empty air and replacing with the same block are no-ops, and duplicate coordinates reject the complete batch.
- Successful state changes increment one monotonic revision. Failures and no-ops do not; undo/redo do increment it.
- Reads use deterministic X-then-Y-then-Z ordering. Slices return explicit axes and complete ascending coordinate matrices.
- Resizing, `dryRun`, core cancellation, shape generation, region transforms, and the compact run-string DSL are deferred beyond the initial exact-edit core.



## 5. Smallest reliable stack



### Runtime

```text
Vite + TypeScript
|-- React       UI, panels, inventory, tabs
|-- Three.js    3D rendering, camera, selection
|-- Zustand     shared UI/application state
|-- Ajv         JSON Schema validation
`-- WebMCP      browser-agent site tools
```



### Development

- Vitest for the plain-TypeScript command engine and validator.
- Browser/manual visual verification for Three.js behavior.



### Why React remains

The planned interface contains sliders, panels, a block palette, selection details, validation output, history, blueprint previews, and future tabs. React keeps this UI understandable. React must not represent every voxel as a component.

### Why Three.js

Three.js is the actual graphics engine. React Three Fiber would add an adapter layer that is not required for this project. A direct renderer creates a clearer separation between the React UI and the voxel renderer, and avoids the temptation to render each block as JSX.

### Why Zustand now

Inventory, tabs, selected blocks, arena configuration, blueprints, and WebMCP-driven UI updates are known requirements rather than hypothetical ones. Using Zustand now prevents later migration of shared UI state.

Zustand must store only application/UI state such as:

- Active tab.
- Selected human palette block.
- Hovered/selected coordinate.
- Arena dimensions and visible Y layer.
- Camera/view preset.
- Selected blueprint.
- Validation panel state.
- Current world revision and summaries exposed to the UI.

Zustand must not become the voxel database. Blocks, commands, validation, and history belong to the plain-TypeScript arena core.

## 6. Core architecture

```text
React UI ---------+
                   |
WebMCP adapter ----+--> Arena command engine --> Arena world store
                   |             |                       |
Future MCP adapter +             +--> simple Validator   +--> Three.js renderer
                                 +--> History            +--> Blueprint serializer
                                 +--> Queries
```



### Architectural rule

The human UI, WebMCP tools, and future integrations must call the same command engine.

Do not create:

- UI-only placement logic.
- Agent-only placement logic.
- Direct WebMCP mutation of Three.js meshes.
- Direct WebMCP mutation of React/Zustand state as the source of truth.

The source of truth is the arena world store. The renderer visualizes it. Zustand exposes appropriate UI state. WebMCP adapts browser-agent calls into the same commands used by humans.

## 7. Proposed source structure

```text
src/
|-- main.tsx
|-- app/
|   `-- App.tsx
|-- core/
|   |-- coordinates.ts
|   |-- block-types.ts
|   |-- block-state.ts
|   |-- arena-config.ts
|   |-- arena-world.ts
|   |-- arena-commands.ts
|   |-- pattern-dsl.ts
|   |-- arena-queries.ts
|   |-- validation.ts
|   |-- history.ts
|   `-- blueprint.ts
|-- render/
|   |-- three-renderer.ts
|   |-- block-mesh-registry.ts
|   |-- arena-grid.ts
|   |-- selection-highlight.ts
|   `-- camera-controls.ts
|-- state/
|   `-- ui-store.ts
|-- ui/
|   |-- BuildArenaPage.tsx
|   |-- BlockPalette.tsx
|   |-- ArenaControls.tsx
|   |-- CoordinateInspector.tsx
|   |-- ValidationPanel.tsx
|   |-- HistoryControls.tsx
|   `-- BlueprintPanel.tsx
|-- schemas/
|   |-- commands.schema.ts
|   `-- blueprint.schema.ts
|-- webmcp/
|   |-- register-arena-tools.ts
|   |-- tool-schemas.ts
|   `-- tool-results.ts
`-- storage/
    |-- blueprint-json.ts
    `-- indexed-db.ts       future
```

Do not create every file immediately. Add a file when its responsibility becomes real; preserve the boundaries above.

## 8. Coordinate model



### Axis convention

```text
X = left/right
Y = height
Z = forward/back
```

Every coordinate is written in the same order:

```text
(x, y, z)
```

Never display a top view as X/Y. A top view is X/Z because Y remains height.

### Default 7x7 platform

The platform occupies:

```text
x = -3...+3
z = -3...+3
y = 0
```

It contains 49 unique platform positions.

Corners:

```text
(-3, 0, +3)   (+3, 0, +3)

(-3, 0, -3)   (+3, 0, -3)
```

Centre:

```text
(0, 0, 0)
```

Example build position:

```text
(2, 3, -1)
```

This means two blocks in positive X, three blocks above the platform, and one block in negative Z.

### Height

- `y = 0`: protected foundation.
- `y = 1`: first buildable level.
- Example initial maximum: `y = 6`.
- A 7x7 arena with six build levels has `7 x 7 x 6 = 294` buildable positions above the platform.



### Why odd platom : 7x7 instead of 6x6

A 6x6 platform has no single centre block. Its geometric centre lies between four blocks. A symmetric integer coordinate system with a real `(0, 0)` centre naturally needs odd dimensions such as 7x7.

### Configurable arena bounds

The default UI may begin at 7x7, but reusable commands and WebMCP tools must read current bounds from `ArenaConfig`.

Suggested configuration:

```ts
type ArenaConfig = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  platformY: 0;
};
```



## 9. Arena world representation



### MVP storage

Use a sparse map so empty space consumes no block entries:

```ts
Map<CoordinateKey, Block>
```

Example keys:

```text
"2,1,-1" -> stone
"2,2,-1" -> oak_log
```

Coordinate-key creation and parsing must live in one module. Do not repeat string concatenation throughout the app.

### Future large-world storage

The future voxel game may replace the sparse map with chunks such as `16x16x16`. Commands and queries must depend on an arena-world interface rather than on direct map access, allowing the storage implementation to change later.

Do not implement chunks before the Build Arena needs them.

## 10. Block data model

Each block requires a type and optional state:

```json
{
  "position": { "x": 2, "y": 1, "z": -1 },
  "block": {
    "type": "oak_stairs",
    "state": {
      "facing": "north",
      "half": "bottom",
      "shape": "straight"
    }
  }
}
```



### Example state properties


| Block      | State                                       |
| ---------- | ------------------------------------------- |
| Log        | `axis: x                                    |
| Stairs     | `facing`, `half`, `shape`                   |
| Slab       | `half: top                                  |
| Trapdoor   | `facing`, `half`, `open`                    |
| Repeater   | `facing`, `delay`, later `powered`/`locked` |
| Water/lava | later `level` if fluid simulation exists    |


Connections for fences, walls, and stair corners should usually be derived from neighbouring blocks by the arena rather than manually specified by the agent.

Rotating or mirroring a blueprint must transform both coordinates and directional block state.

## 11. Planned block catalogue



### Phase A: full cubes ( BUILD IN FIRST PHASE )

- Dirt.
- Stone.
- Oak log.
- Oak planks (`wood` should use an explicit block ID).
- Leaves.
- Glass.
- Obsidian.



### Phase B: special visuals and partial geometry

- Static water.
- Static lava.

PARTIAL BLOCKS 

- Slabs.
- Stairs.
- Fences.
- Walls.
- Trapdoors.



### Phase C: COMPUTER pieces

- Redstone dust.
- Repeater.
- Redstone torch.
- Lever/button.
- Redstone lamp.
- Optional comparator, redstone block, pistons, observers, pressure plates, and target blocks depending on circuit designs.

Correct spellings in schemas and UI should be `redstone` and `repeater`.

## 12. Command engine

Commands are the only supported way to mutate arena world state.

### Exact block edits

- Set/place a block.
- Remove a block.
- Replace a block atomically.
- Apply a bounded batch of exact edits.

Replacement is one atomic command. Do not commit a separate remove followed by a separate place because a failure between them leaves incorrect state.

### Shape operations

- Floor/filled plane.
- Wall.
- Filled box.
- Hollow box.
- Roof pattern later.
- Repeated pattern along an axis, including compact run-strings such as `oak_planks_1-(x5)`.



### Region transforms

- Copy.
- Move.
- Rotate by supported right angles.
- Mirror across X or Z.
- Replace one block type with another inside a region.



### History

- Undo.
- Redo.
- Each committed command records its exact before/after diff.
- A multi-block agent operation is one history entry.



### Concurrency

Every committed world mutation increments a revision number.

WebMCP writes should include `expectedRevision`. If a user modifies the build after the agent reads it, the stale agent write is rejected instead of overwriting newer work.

## 13. JSON strategy and compact run-strings

JSON remains the interchange format for:

- Structured WebMCP tool arguments.
- Blueprint export/import.
- Exact `set_blocks` batches.

Keep structured JSON efficient and short. Measure tool-token cost, generation failures, and batch-size limits.

Agents also need a shorter write language for repeated runs (a wall of five oak planks, a floor along +Z). That is a compact **run-string**, not a second world format.

### Compact run-string

Example:

```text
oak_planks_1-(x5)
```


| Part      | Example      | Meaning                                      |
| --------- | ------------ | -------------------------------------------- |
| block     | `oak_planks` | block type (explicit id, not generic `wood`) |
| object id | `_1`         | named object in the layer tree               |
| sign      | `-` or `+`   | direction on that axis                       |
| axis      | `x`          | `x`, `y`, or `z`                             |
| count     | `5`          | how many copies along that axis              |


Layer tree example (sidebar grouping and agent grouping):

```text
Wall_X
  oak_planks_1-(x5)
  stone_2+(x6)
Surface_Z
  oak_planks_1-(z13)
  oak_planks_2+(z21)
```

Rules:

- `pattern-dsl.ts` parses the string. Invalid strings fail before any world mutation.
- The parser emits the same `generate_shape` / place commands used by JSON tools.
- Domain validation, bounds, platform protection, revision, and undo still apply.
- Blueprints stay versioned JSON. Do not store the live world as run-strings.
- Implement the parser when shape operations exist (Phase 6). Phase 1–5 keep JSON commands.



## 14. Validation and error detection

Keep error handling visible and simple.

```text
JSON entered
   |
   v
Browser parses JSON
   |-- Error -> show line/column + Copy fix prompt
   `-- Valid -> run essential arena checks -> apply
```



### JSON syntax error

When pasted or imported JSON cannot be parsed, show the parser message and line/column when available:

```text
JSON error at line 145, column 18
Expected a comma after "block".

[Copy fix prompt]
```

The copied prompt should be short:

```text
Fix this Build Arena JSON error:
Line 145, column 18: Expected a comma after "block".
Return only corrected JSON.
```



### Valid JSON with a wrong value

Valid JSON can still contain an unknown block, an out-of-bounds coordinate, too many edits, or an attempt to change the protected platform. Run only these essential checks before applying it.

When there is no source line, show the exact field path or coordinate instead:

```text
operations[3].position.y must be 1 or greater.
```

WebMCP normally sends a structured object rather than a text document, so WebMCP errors should use field paths instead of invented line numbers.

No separate `validate_build` WebMCP tool is required for the MVP. Parsing and essential checks happen automatically when JSON or a tool command is submitted.

## 15. WebMCP integration

### Meaning

WebMCP lets the open page expose structured actions to compatible browser agents. The page and agent share the same live browser state and visible UI.

WebMCP is not the same as a standalone MCP server:


| WebMCP                               | Traditional MCP                      |
| ------------------------------------ | ------------------------------------ |
| Lives in the open web page           | Lives in a local/remote server       |
| Shares live page/session state       | Can work without the page open       |
| Tools follow page lifecycle          | Tools may be persistent              |
| Best for cooperative visible editing | Best for headless/service operations |


WebMCP must remain a thin adapter. A future standard MCP server should adapt the same arena command engine for harnesses that do not support WebMCP.

### Current API boundary

- Use current `document.modelContext.registerTool(...)` only after checking browser support.
- Do not use older `navigator.registerTool(...)` examples.
- Feature-detect the API so unsupported browsers still run the arena normally.
- WebMCP is evolving; verify the specification and host support when implementation starts.



### Lifecycle

- Register Build Arena tools when the arena context is active.
- Hold an `AbortController` for registrations.
- Abort registrations when the relevant component/page is disposed.
- In the future single-page app, register game-specific tools only in the Game context and arena-specific tools in the Build Arena context.
- Do not continually re-register tools merely because normal world data changed; return revisioned data through read results.



### Tool annotations and security

- Mark read tools with `annotations: { readOnlyHint: true }`.
- Describe all write side effects plainly.
- Do not expose arbitrary JavaScript, Python, shell, or code-execution tools.
- Treat tool metadata and results as untrusted content.
- Let the browser perform its normal tool safety review.
- Never treat WebMCP as permission to share unrelated browser information.



## 16. Proposed WebMCP tools

Start with the smallest useful set backed by real command-engine capabilities.

### Read tools



#### `get_arena_context`

Returns:

- Coordinate convention.
- Current X/Y/Z bounds.
- Platform Y.
- Current revision.
- Available block types and supported block states.
- Operation limits.
- Current selected/active blueprint summary where appropriate.



#### `get_build_summary`

Returns:

- Occupied bounds.
- Total block count.
- Counts by block type.
- Named component list later.
- Validation error/warning counts.
- Current revision.



#### `query_blocks`

Filters by:

- Bounding region.
- Y layer.
- Block type.
- Named component later.
- Pagination/maximum result count.



#### `get_build_slices`

Returns exact 2D matrices or compact grids for:

- X/Z top layers.
- X/Y front/side slices.
- Z/Y side slices.

Structured slices are more reliable for exact coordinates than screenshots.

#### `render_build_views`

Creates visible diagnostic views:

- Top.
- Front.
- Right side.
- Isometric.
- Optional back/left/specific axis.
- Optional region highlight and coordinate grid.

Do not render every axis after every small edit. Images are for visual verification; structured block queries remain the source of truth.

Because multimodal tool-result portability may vary, the tool should also update a visible diagnostics canvas/panel and return metadata or a view identifier.

### Write tools



#### `set_blocks`

- Place/set explicit blocks.
- Atomically replace existing blocks.
- Explicitly remove blocks.
- Include block type and state in every write.
- Enforce a maximum edit count.



#### `generate_shape`

- Floors.
- Walls.
- Filled/hollow boxes.
- Later roofs and repeated patterns.
- Later: compact run-strings such as `oak_planks_1-(x5)`, parsed by `pattern-dsl.ts` into this command.



#### `transform_region`

- Copy/move.
- Rotate.
- Mirror.
- Replace block types in a region.



#### `undo_build_change`

Undo a specific supported change or the most recent eligible change. Return the resulting revision and affected bounds.

#### `save_blueprint`

Validate and save the active arena build as a blueprint with preview metadata.

### Do not require an agent `choose_block` tool

Human palette selection is useful. Agent selection as hidden mutable state is fragile. Every agent write must explicitly include the intended block type and state.

## 17. Tool transaction contract

Agent mutations should support:

- `expectedRevision` for stale-write protection.
- Optional `dryRun` for large/uncertain operations.
- Bounded operation arrays.
- Atomic application.
- Cancellation through `AbortSignal` for long work.

Successful response example:

```json
{
  "success": true,
  "revision": 43,
  "affectedBlocks": 720,
  "affectedBounds": {
    "min": { "x": -3, "y": 1, "z": -3 },
    "max": { "x": 3, "y": 4, "z": 3 }
  },
  "warnings": [],
  "undoId": "change-43"
}
```

The response must contain enough information for the agent to decide whether to inspect, validate, render, undo, or continue.

## 18. Agent observation loop

Do not constantly dump the complete build or all screenshots into the model.

Recommended loop:

```text
1. get_arena_context
2. get_build_summary
3. query the relevant region/layer/component
4. apply one meaningful bounded batch
5. inspect returned revision and changed bounds
6. validate
7. render only useful views
8. correct or continue
```

Every read should include the current revision so observations can be connected to later writes.

## 19. Renderer plan



### MVP Three.js scene

- `WebGLRenderer`.
- Perspective camera.
- Orbit controls.
- Directional and ambient lighting.
- Arena platform/grid.
- Raycaster for hover/click selection.
- Selection/placement preview outline.
- Instanced meshes grouped by block geometry/material.



### Block rendering

Use `InstancedMesh` for repeated identical full cubes. One stone mesh can render many stone instances, reducing GPU draw calls.

Do not create:

- One React component per block.
- One independent material for every identical block.
- Continuous React re-rendering on every animation frame.



### Partial blocks

Use registered geometries per supported type/state. Orientation is applied through transforms. Neighbour-derived geometry/connection state must update affected neighbours when a block changes.

### Performance evolution

1. Begin with instancing by block type.
2. Measure block count, frame time, draw calls, and edit/update cost.
3. Add chunking when large builds justify it.
4. Add greedy meshing only if chunk rendering remains a measured bottleneck.
5. Move expensive validation or redstone simulation to a Web Worker only when it blocks the UI.



## 20. Build Arena UI

Suggested desktop layout:

![Build Arena UI Layout](/assets/BUILD_arena_UI.png)


### Core controls

- Block palette for humans.
- Current coordinate inspector.
- Top/front/right/isometric camera presets.
- Undo and redo.
- Validate.
- Export/import blueprint JSON.
- Save blueprint later.
- increase platform size sliders on **X,Z*and y * (odd × odd x odd ).
- Layer tree for named objects and run-strings (`Wall_X`, `Surface_Z`); select, move, duplicate, multiply on an axis.



### Coordinate presentation

- Show X/Z numbers around the top-view grid.
- Clearly colour X, Y, and Z axes.
- Highlight `(0, 0, 0)`.
- Show exact `(x, y, z)` on hover/selection rather than permanently filling the 3D scene with hundreds of labels.
- Allow layer isolation and ghost lower layers for roofs/multi-storey work.



### Accessibility

- Every palette item and control needs a text label.
- Do not communicate validation state using colour alone.
- Support keyboard focus for controls.
- Provide coordinate and selected-block information in text outside the canvas.
- Maintain readable contrast.



## 21. Blueprint format and inventory



### Initial persistence

- Export blueprint to versioned JSON.
- Import blueprint from JSON after validation.
- Keep automatic IndexedDB persistence out of the first arena milestone unless required.



### Blueprint data

```json
{
  "schemaVersion": 1,
  "id": "blueprint-house-01",
  "name": "Oak Starter House",
  "size": { "x": 7, "y": 6, "z": 7 },
  "anchor": { "x": 0, "y": 0, "z": 0 },
  "blocks": [],
  "blockSummary": {
    "oak_planks": 120,
    "stone": 48
  },
  "validation": {
    "errors": 0,
    "warnings": 1
  },
  "preview": {
    "view": "isometric",
    "reference": "future-preview-reference"
  }
}
```



### Future inventory preview

Each card should show:

- Thumbnail.
- Name.
- Dimensions.
- Block count.
- Important materials.
- Validation badge.
- Rotation/orientation preview.



### Future game placement

1. Select blueprint from inventory.
2. Show transparent ghost preview.
3. Rotate or mirror around its anchor.
4. Highlight collisions in red.
5. Protect immutable game terrain.
6. Commit placement atomically.
7. Record one undo/history action where supported.



## 25. Implementation phases



### Phase 0: decisions and scaffolding

- Confirm Minecraft-inspired versus compatible.
- Confirm initial arena height.
- Confirm the Phase A block list.
- Scaffold Vite + TypeScript + React.
- Add Three.js, Zustand, and Ajv.
- Establish formatting/testing only to the minimum needed by the project.

Success: app starts with a React shell and empty Three.js canvas.

### Phase 1: plain-TypeScript arena core

- Coordinate types and helpers.
- Arena configuration.
- Sparse world store.
- Full-cube block registry.
- Place/remove/atomic replace commands.
- Revisioning.
- Validation.
- Undo/redo.
- Unit tests for core invariants.

Success: the complete world can be manipulated without React or Three.js.

### Phase 2: Three.js arena renderer

- 7x7 protected platform.
- Camera, lighting, orbit controls.
- Instanced full-cube rendering.
- Raycast hover/click.
- Coordinate selection display.
- Renderer subscription to committed world changes.

Success: human can inspect and place/remove Phase A blocks reliably.

### Phase 3: React/Zustand editor UI

- Palette.
- Arena controls.
- Coordinate inspector.
- History controls.
- Validation panel.
- Camera presets.
- Layer visibility and the object / run-string tree (`Wall_X`, `Surface_Z`).

Success: the Build Arena works as a coherent human editor.

### Phase 4: blueprint JSON

- Versioned schema.
- Ajv import validation.
- Export.
- Import.
- Summary and preview metadata.

Success: a build survives export/import with no coordinate or block-state loss.

### Phase 5: WebMCP

- Verify current WebMCP and Codex site-tool APIs.
- Register minimal read tools.
- Register bounded edit tools backed by the command engine.
- Add revision protection and verification results.
- Add cleanup lifecycle.
- Confirm unsupported browsers remain functional.

Success: a supported browser agent can inspect, edit, validate, and undo a build without bypassing arena rules.

### Phase 6: partial blocks and advanced operations

- Slabs/stairs first.
- Directional rotation.
- Fences/walls/trapdoors.
- Shape generator.
- Compact run-string parser (`oak_planks_1-(x5)`) compiling into shape/place commands.
- Region transforms.
- More precise views/slices.

Success: agents can build useful houses efficiently rather than placing every block individually.

### Phase 7: inventory and future game

- Inventory cards and thumbnails.
- Game tab.
- Immutable flat dirt world.
- Ghost blueprint placement.
- Collision checks and commit.



### Phase 8: optional redstone simulator

- Confirm bounded supported component set.
- Tick engine.
- Signal propagation.
- Circuit diagnostics and Web Worker if measured necessary.
- `simulate_redstone` read tool.



## 26. Likely failure points and handling


| Failure                               | Why it could happen                                    | Handling/fallback                                                                                                  |
| ------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Agent edits stale state               | Human changes build between read and write             | Require `expectedRevision`; reject and ask agent to re-read                                                        |
| Huge tool call freezes UI             | Agent requests thousands/millions of blocks            | Enforce schema and affected-block limits; dry-run and split by component                                           |
| Half-applied structure                | A later edit in a batch fails                          | Calculate first and commit atomically                                                                              |
| WebMCP unavailable                    | Browser/host lacks current API                         | Feature-detect; keep full human UI; add standard MCP adapter later                                                 |
| Tool descriptions drift from behavior | Commands evolve but adapter does not                   | Keep handlers thin; reuse commands; test side effects and outputs                                                  |
| Coordinates become confusing          | UI calls top view X/Y or resize shifts origin          | Use X/Z consistently; central coordinate helpers; explicit resize rules                                            |
| React becomes slow                    | World blocks stored/rendered as React state/components | Keep voxel data in core and render with Three.js instancing                                                        |
| Too many draw calls                   | One mesh/material per block                            | Group by geometry/material with `InstancedMesh`; measure before chunking                                           |
| Partial blocks rotate incorrectly     | Coordinates rotate but state does not                  | Central transform logic covers both position and directional state                                                 |
| Blueprint becomes incompatible        | Schema evolves without versioning                      | Require `schemaVersion` and explicit migrations                                                                    |
| Images mislead the agent              | Occlusion hides exact blocks                           | Use coordinate queries/slices as truth; images only for visual review                                              |
| Redstone consumes the project         | Full Minecraft behavior is attempted early             | Keep it visual initially; define a bounded simulator milestone                                                     |
| Compact run-string parse fails        | Agent sends `wood_1-(x5)` or a malformed token         | Reject with a field-level parse error; do not mutate; suggest the corrected string and the equivalent JSON command |




## 27. Security and reliability rules

- Validate all WebMCP, imported JSON, and compact run-string input.
- Treat JSON Schema as the first validation layer, not the only one.
- Never expose arbitrary code execution.
- Limit operations and affected blocks.
- Keep platform protection inside domain validation.
- Preserve undo/history for agent mutations.
- Return explicit failure; never claim success after a partial or unexpected failure.
- Keep WebMCP optional and page-scoped.
- Do not allow tools to access unrelated browser/page information.
- Make side effects visible in tool descriptions and results.



## 28. MVP success criteria

The Build Arena MVP is complete when:

- A centred 7x7 platform renders with correct X/Z orientation.
- `(0, 0, 0)` is the centre platform block.
- The platform cannot be modified.
- Humans can select, place, replace, and remove Phase A blocks above `y = 0`.
- Coordinates shown by the UI match core world state.
- Commands are atomic, bounded, validated, revisioned, and undoable.
- The world is not stored as React components or Zustand block state.
- Blueprint JSON can export/import without data loss.
- Supported WebMCP agents can read and modify the arena through the same command engine.



## 29. Authoritative references

- WebMCP specification: [https://webmachinelearning.github.io/webmcp/](https://webmachinelearning.github.io/webmcp/)
- WebMCP repository: [https://github.com/webmachinelearning/webmcp](https://github.com/webmachinelearning/webmcp)
- Codex site tools: [https://learn.chatgpt.com/docs/webmcp](https://learn.chatgpt.com/docs/webmcp)
- Three.js `InstancedMesh`: [https://threejs.org/docs/pages/InstancedMesh.html](https://threejs.org/docs/pages/InstancedMesh.html)
- Minecraft Wiki redstone computers: [https://minecraft.wiki/w/Tutorial%3ARedstone_computers](https://minecraft.wiki/w/Tutorial%3ARedstone_computers)

When implementation begins, verify the current WebMCP API against authoritative sources because it is still evolving.
