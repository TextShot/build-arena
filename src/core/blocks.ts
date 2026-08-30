import type { BlockId } from "./block-types";

export type BlockCatalogueEntry = Readonly<{
  id: BlockId;
  label: string;
  fullCube: true;
}>;

export const BLOCK_CATALOGUE = Object.freeze({
  dirt: Object.freeze({ id: "dirt", label: "Dirt", fullCube: true }),
  stone: Object.freeze({ id: "stone", label: "Stone", fullCube: true }),
  oak_log: Object.freeze({ id: "oak_log", label: "Oak log", fullCube: true }),
  oak_planks: Object.freeze({ id: "oak_planks", label: "Oak planks", fullCube: true }),
  leaves: Object.freeze({ id: "leaves", label: "Leaves", fullCube: true }),
  glass: Object.freeze({ id: "glass", label: "Glass", fullCube: true }),
  obsidian: Object.freeze({ id: "obsidian", label: "Obsidian", fullCube: true }),
} satisfies Record<BlockId, BlockCatalogueEntry>);
