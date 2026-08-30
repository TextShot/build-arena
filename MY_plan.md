# My plan (product notes)

There will be two tabs : the game and the build arena . 
The build arena will be simpler for agent to understand , communicate and build stuff using the Blocks.
Then we can select the build in from you inventory to place it in game .

Mission : add web mcp to the game - so that agents can use tools to help us build from harness like codex. 
User will prompt in harness and model harness will do the building . 

## Product

Minecraft-inspired web voxel game. Two tabs later:

- **Build Arena** — simpler workspace so a human or agent can build with blocks.
- **Game** — pick a build from inventory and place it in the world.

Mission: add **WebMCP** so a harness like Codex can inspect the live page and build with tools.

Build the **arena first**. Game tab, inventory placement, partials, and redstone follow the arena phases. Do not treat a working redstone computer as the first success test.

Flow:

```text
Human or agent prompt
        |
        v
Build Arena  (create + inspect + validate)
        |
        v
Blueprint inventory  (thumbnail + size + counts + JSON)
        |
        v
Future game  (ghost preview + rotate/mirror + place)
```

## Coordinates (use this, not the old X/Y platform wording)

- Always `(x, y, z)`.
- **X and Z** = ground. **Y** = height.
- Platform sliders grow **X and Z**. Keep odd sizes (default **7×7**) so `(0, 0, 0)` is a real centre block.
- Platform at `y = 0` cannot be edited.
- All six directions exist: `+X -X +Y -Y +Z -Z`.
- A top view is **X/Z**, never X/Y.

## Agent tools

Human UI and WebMCP must use the **same** command engine.

**Writes**

- Place / set a block at coordinates.
- Generate walls, floors, roofs.
- Repeat / multiply along an axis (string language below).
- Remove a block.
- Replace a block **atomically** (one command). Do not implement replace as a separate break then place.
- Rotate / orient directional blocks.
- Partial blocks (slabs, stairs, fences, walls, trapdoors) belong in `place` later. **Phase A is full cubes only.**

**Reads** — do **not** dump the whole build or every screenshot every turn.

- Coordinates, bounds, revision, and whatever else the agent needs for the current step.
- Query a region / layer / block type.
- 2D slices (more reliable than images for exact blocks).
- Optional `view_images` from all axes in a grid, or from one axis.
- List named objects / layers (later).

## Compact string language (Phase 6, not Arena MVP)

Agents may send repeated-run strings like:

```text
oak_planks_1-(x5)
```

Meaning:

| Part | Example | Meaning |
|---|---|---|
| block | `oak_planks` | material |
| object id | `_1` | which object in the layer tree |
| sign | `-` or `+` | direction on that axis |
| axis | `x` | `x`, `y`, or `z` |
| count | `5` | how many copies along that axis |

Layer tree (sidebar + agent grouping):

```text
Wall_X
  oak_planks_1-(x5)
  stone_2+(x6)
Surface_Z
  oak_planks_1-(z13)
  oak_planks_2+(z21)
```

The future arena command engine must parse these strings into the same place / `generate_shape` commands (atomic, bounded, revisioned). Phase 0–5 uses structured JSON only; the parser and shape generation begin in Phase 6 after exact edits are reliable.

## Build Arena UI

- Preview of the build centred on the platform.
- Collapsible sidebar:
  - Sliders to grow the platform on **X and Z** (odd × odd).
  - Layers: select an object, change coordinates, duplicate / multiply on an axis.
- Inventory cards need a **preview thumbnail** so the user knows what they are selecting.

## Blocks

**Phase A (first):** dirt, stone, oak log, oak planks, leaves, glass, obsidian.

**Later visuals:** static water, static lava (no fluid simulation in the arena MVP).

**Later partials:** slabs, stairs, fences, walls, trapdoors.

**Later computer set:** redstone, repeater, torch, lever, lamp, and related pieces. Spellings in schemas/UI: `redstone`, `repeater`.

## Game (later, not v1)

Flat dirt landscape. Ground blocks are indestructible. Place blueprints from inventory with ghost preview, rotate/mirror, then commit.

## Separate docs

- Arena implementation: `docs/BUILD_ARENA_PLAN.md`
- Game / redstone: `docs/minecraft.md`
