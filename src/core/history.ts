import type { BlockChange } from "./arena-engine";

export type HistoryEntry = Readonly<{
  id: string;
  changes: readonly BlockChange[];
}>;

function freezeChanges(changes: readonly BlockChange[]): readonly BlockChange[] {
  return Object.freeze(changes.map((change) => Object.freeze({
    position: Object.freeze({ ...change.position }),
    before: change.before,
    after: change.after,
  })));
}

export class HistoryManager {
  private readonly undoEntries: HistoryEntry[] = [];
  private readonly redoEntries: HistoryEntry[] = [];
  private nextId = 1;

  record(changes: readonly BlockChange[]): HistoryEntry {
    const entry = Object.freeze({
      id: `undo-${this.nextId++}`,
      changes: freezeChanges(changes),
    });
    this.undoEntries.push(entry);
    this.redoEntries.length = 0;
    return entry;
  }

  peekUndo(): HistoryEntry | undefined {
    return this.undoEntries[this.undoEntries.length - 1];
  }

  peekRedo(): HistoryEntry | undefined {
    return this.redoEntries[this.redoEntries.length - 1];
  }

  moveUndoToRedo(): HistoryEntry | undefined {
    const entry = this.undoEntries.pop();
    if (entry) this.redoEntries.push(entry);
    return entry;
  }

  moveRedoToUndo(): HistoryEntry | undefined {
    const entry = this.redoEntries.pop();
    if (entry) this.undoEntries.push(entry);
    return entry;
  }
}

