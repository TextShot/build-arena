import { BLOCK_CATALOGUE } from "../core/blocks";
import { PALETTE_BLOCK_IDS, type BlockId } from "../core/block-types";

type BlockPaletteProps = Readonly<{
  selectedBlock: BlockId;
  onSelect: (block: BlockId) => void;
  onOpenInventory: () => void;
}>;

export function BlockPalette({ selectedBlock, onSelect, onOpenInventory }: BlockPaletteProps) {
  return (
    <section className="block-palette" aria-labelledby="block-palette-title">
      <h2 className="sr-only" id="block-palette-title">Block palette</h2>
      {PALETTE_BLOCK_IDS.map((blockId) => {
        const block = BLOCK_CATALOGUE[blockId];
        const selected = blockId === selectedBlock;
        return (
          <button
            aria-label={`Select ${block.label}`}
            aria-pressed={selected}
            className="block-choice"
            data-block={blockId}
            key={blockId}
            onClick={() => onSelect(blockId)}
            title={block.label}
            type="button"
          >
            <span aria-hidden="true" className="block-swatch" />
            <span className="block-choice-label">{block.label}</span>
            {selected && <span className="block-selected-mark">Selected</span>}
          </button>
        );
      })}
      <button
        aria-label="Open inventory"
        className="block-choice inventory-slot"
        onClick={onOpenInventory}
        title="Inventory"
        type="button"
      >
        <span aria-hidden="true" className="block-swatch">⋯</span>
        <span className="block-choice-label">Inventory</span>
      </button>
    </section>
  );
}
