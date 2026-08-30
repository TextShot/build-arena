import type { BlockId } from "./block-types";

export type BlockCatalogueEntry = Readonly<{
  id: BlockId;
  label: string;
  fullCube: boolean;
}>;

export const BLOCK_CATALOGUE = Object.freeze({
  dirt: Object.freeze({ id: "dirt", label: "Dirt", fullCube: true }),
  stone: Object.freeze({ id: "stone", label: "Stone", fullCube: true }),
  oak_log: Object.freeze({ id: "oak_log", label: "Oak log", fullCube: true }),
  oak_planks: Object.freeze({ id: "oak_planks", label: "Oak planks", fullCube: true }),
  leaves: Object.freeze({ id: "leaves", label: "Leaves", fullCube: true }),
  glass: Object.freeze({ id: "glass", label: "Glass", fullCube: true }),
  obsidian: Object.freeze({ id: "obsidian", label: "Obsidian", fullCube: true }),
  water: Object.freeze({ id: "water", label: "Water", fullCube: false }),
  lava: Object.freeze({ id: "lava", label: "Lava", fullCube: false }),
  oak_slab: Object.freeze({ id: "oak_slab", label: "Oak slab", fullCube: false }),
  oak_stairs: Object.freeze({ id: "oak_stairs", label: "Oak stairs", fullCube: false }),
  oak_fence: Object.freeze({ id: "oak_fence", label: "Oak fence", fullCube: false }),
  stone_wall: Object.freeze({ id: "stone_wall", label: "Stone wall", fullCube: false }),
  oak_trapdoor: Object.freeze({ id: "oak_trapdoor", label: "Oak trapdoor", fullCube: false }),
  redstone_wire: Object.freeze({ id: "redstone_wire", label: "Redstone Dust", fullCube: false }),
  redstone_torch: Object.freeze({ id: "redstone_torch", label: "Redstone Torch", fullCube: false }),
  redstone_block: Object.freeze({ id: "redstone_block", label: "Redstone Block", fullCube: true }),
  lever: Object.freeze({ id: "lever", label: "Lever", fullCube: false }),
  button: Object.freeze({ id: "button", label: "Button", fullCube: false }),
  repeater: Object.freeze({ id: "repeater", label: "Repeater", fullCube: false }),
  comparator: Object.freeze({ id: "comparator", label: "Comparator", fullCube: false }),
  lamp: Object.freeze({ id: "lamp", label: "Redstone Lamp", fullCube: false }),
  piston: Object.freeze({ id: "piston", label: "Piston", fullCube: true }),
} satisfies Record<BlockId, BlockCatalogueEntry>);
