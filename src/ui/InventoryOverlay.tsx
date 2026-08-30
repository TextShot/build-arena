import { useEffect } from "react";

import type { InventoryEntry } from "../storage/inventory";

type InventoryOverlayProps = Readonly<{
  entries: readonly InventoryEntry[];
  onClose: () => void;
  onDelete: (id: string) => void;
}>;

export function InventoryOverlay({ entries, onClose, onDelete }: InventoryOverlayProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="inventory-overlay" onClick={onClose} role="presentation">
      <div
        aria-label="Inventory"
        className="inventory-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <h2>Inventory</h2>
        {entries.length === 0 ? (
          <p className="empty-state">No saved builds</p>
        ) : (
          <ul className="inventory-list">
            {entries.map((entry) => (
              <li key={entry.id}>
                <img alt="" height={48} src={entry.thumbnail} width={48} />
                <span className="inventory-name">{entry.name}</span>
                <button onClick={() => onDelete(entry.id)} type="button">Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
