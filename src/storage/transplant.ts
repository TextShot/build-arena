export const ARENA_TO_WORLD_FACING = {
  north: "N",
  east: "E",
  south: "S",
  west: "W",
} as const;

export type ArenaFacing = keyof typeof ARENA_TO_WORLD_FACING;

export function arenaBlockToPlaceOpts(block: {
  state?: { facing?: string; mode?: string };
}): { facing?: string; mode?: string } {
  const facing = block.state?.facing
    ? ARENA_TO_WORLD_FACING[block.state.facing as ArenaFacing]
    : undefined;
  const mode = block.state?.mode;
  return { facing, mode };
}

export function worldCoord(
  block: { x: number; y: number; z: number },
  origin: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  return {
    x: origin.x + block.x,
    y: block.y - 1,
    z: origin.z + block.z,
  };
}
