export const INVENTORY_KEY = "build-arena.inventory.v1";
export const HANDOFF_KEY = "build-arena.handoff.v1";

const EMPTY = Object.freeze({ version: 1, entries: [] });

export function readInventory() {
  try {
    const raw = localStorage.getItem(INVENTORY_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) return EMPTY;
    return parsed;
  } catch {
    return EMPTY;
  }
}

export function readAndClearHandoff() {
  try {
    const raw = localStorage.getItem(HANDOFF_KEY);
    localStorage.removeItem(HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || (parsed.kind !== "visit" && parsed.kind !== "place")) return null;
    return parsed;
  } catch {
    try { localStorage.removeItem(HANDOFF_KEY); } catch { /* ignore */ }
    return null;
  }
}
