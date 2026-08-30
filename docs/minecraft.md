## 22. Future game integration

The future game is a separate adapter and renderer context over compatible voxel concepts. The first world landscape is a flat dirt plane whose ground blocks are indestructible.

Two future tabs:

- Game.
- Build Arena.

The Build Arena produces reusable local-coordinate blueprints. The game places them using a transform:

```text
world position = blueprint-local position
               + placement origin
               + rotation/mirroring transform
```

Do not store blueprints directly in world coordinates.

## 23. Redstone computer scope

A visual redstone computer and a functional redstone computer are different products.

### Minimum practical visual component set

- Solid opaque block such as stone.
- Redstone dust.
- Redstone torch.
- Repeater.
- Lever/button input.
- Redstone lamp output.

Depending on architecture:

- Comparator.
- Redstone block.
- Pistons/sticky pistons.
- Observer.
- Pressure plate.
- Target block.
- Glass/coloured blocks for routing and labels.

### Functional simulation requirements

- Signal strength 0...15.
- Directional connectivity.
- Repeater orientation and delay.
- Torch inversion and possibly burnout rules.
- Tick scheduler.
- Block-update propagation.
- Stable circuit inspection.
- Optional pistons, observers, comparators, and moving blocks.

This is a major subsystem. Do not use a functional redstone computer as the Build Arena MVP acceptance test.

### Future semantic components

Large builds and computers should support named groups such as:

- `front_wall`.
- `roof`.
- `clock`.
- `register_a`.
- `alu`.
- `memory`.
- `data_bus`.
- `output_display`.

This lets an agent inspect logical components rather than thousands of unrelated coordinates.

## 24. Testing strategy

### Unit tests for the arena core

- Coordinate key round-trip.
- 7x7 default bounds.
- Platform immutability.
- Place into empty position.
- Atomic replace.
- Remove build block.
- Reject out-of-bounds coordinate.
- Reject invalid block state.
- Reject oversized batches.
- Reject stale revisions.
- Whole batch rolls back if one edit fails.
- Undo/redo restores exact state.
- Rotate/mirror transforms coordinates and directional state.
- Blueprint serialization round-trip.

### WebMCP adapter tests

- App works when `document.modelContext` is absent.
- Read tools do not mutate world state.
- Tool inputs are narrow and reject additional fields.
- Tool calls reuse command-engine methods.
- Aborting registration removes the active tool set.
- Tool results include revision and verification data.

### Manual visual checks

- Coordinates match selected blocks.
- Centre origin is correct.
- Camera presets frame the arena.
- Instanced blocks update after commands.
- Partial-block orientation appears correctly.
- Hover/selection does not drift after resize.
- Validation locations highlight the right block.

Mayank prefers to run verification. Implementation tasks should provide focused copy-paste commands rather than automatically running long builds or broad test suites.
