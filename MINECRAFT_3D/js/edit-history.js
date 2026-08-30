const cloneState = (state) => state ? { ...state } : null;

export function readWorldBlockState(world, position) {
  return cloneState(world.blocks.get(position.join(",")) ?? null);
}

export function readWorldBlockRevision(world, position) {
  return world.blockRevisions?.get(position.join(",")) ?? 0;
}

export function applyWorldBlockState(world, position, state) {
  if (!state) {
    world.remove(...position);
    return;
  }
  world.place(...position, state.id, state);
  Object.assign(world.blocks.get(position.join(",")), state);
  world.refresh();
}

function statesEqual(left, right) {
  if (left === null || right === null) return left === right;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (key === "on" || key === "text") continue;
    if (left[key] !== right[key]) return false;
  }
  return true;
}

export class EditHistory {
  constructor({ readState, applyState, readRevision = () => null, limit = 100 }) {
    this.readState = readState;
    this.applyState = applyState;
    this.readRevision = readRevision;
    this.limit = limit;
    this.undoEntries = [];
    this.redoEntries = [];
  }

  record(position, before, after, revisions = {}) {
    if (statesEqual(before, after)) {
      const positionKey = position.join(",");
      let latestAtPosition = null;
      for (let i = this.undoEntries.length - 1; i >= 0; i--) {
        if (this.undoEntries[i].position.join(",") === positionKey) {
          latestAtPosition = this.undoEntries[i];
          break;
        }
      }
      if (latestAtPosition
        && statesEqual(latestAtPosition.after, after)
        && revisions.before === latestAtPosition.afterRevision) {
        latestAtPosition.afterRevision = revisions.after ?? this.readRevision(position);
      }
      this.redoEntries = [];
      return;
    }
    this.undoEntries.push({
      position: [...position],
      before: cloneState(before),
      after: cloneState(after),
      beforeRevision: revisions.before ?? null,
      afterRevision: revisions.after ?? this.readRevision(position),
    });
    if (this.undoEntries.length > this.limit) this.undoEntries.shift();
    this.redoEntries = [];
  }

  undo() {
    return this.#apply(this.undoEntries, this.redoEntries, "after", "before");
  }

  redo() {
    return this.#apply(this.redoEntries, this.undoEntries, "before", "after");
  }

  clear() {
    this.undoEntries = [];
    this.redoEntries = [];
  }

  #apply(source, destination, expectedKey, nextKey) {
    const entry = source.at(-1);
    if (!entry) return { status: "empty" };
    const expectedRevision = entry[`${expectedKey}Revision`];
    const currentState = this.readState(entry.position);
    if (!statesEqual(currentState, entry[expectedKey])
      || (expectedRevision !== null && this.readRevision(entry.position) !== expectedRevision)) {
      this.clear();
      return { status: "conflict" };
    }
    entry[expectedKey] = cloneState(currentState);
    source.pop();
    this.applyState(entry.position, cloneState(entry[nextKey]));
    const appliedRevision = this.readRevision(entry.position);
    entry[`${nextKey}Revision`] = appliedRevision;
    const nextEntry = source.at(-1);
    if (nextEntry
      && nextEntry.position.join(",") === entry.position.join(",")
      && statesEqual(this.readState(entry.position), nextEntry[expectedKey])) {
      nextEntry[`${expectedKey}Revision`] = appliedRevision;
    }
    destination.push(entry);
    return { status: "applied" };
  }
}

export class ManualEditor {
  constructor(world, { limit = 100 } = {}) {
    this.world = world;
    this.editingLocked = false;
    this.history = new EditHistory({
      limit,
      readState: (position) => readWorldBlockState(world, position),
      applyState: (position, state) => applyWorldBlockState(world, position, state),
      readRevision: (position) => readWorldBlockRevision(world, position),
    });
  }

  isLocked() {
    return this.editingLocked;
  }

  toggleLocked() {
    this.editingLocked = !this.editingLocked;
    return this.editingLocked;
  }

  edit(position, mutate) {
    if (this.editingLocked) return { status: "locked" };
    const before = readWorldBlockState(this.world, position);
    const beforeRevision = readWorldBlockRevision(this.world, position);
    mutate();
    const after = readWorldBlockState(this.world, position);
    const afterRevision = readWorldBlockRevision(this.world, position);
    this.history.record(position, before, after, { before: beforeRevision, after: afterRevision });
    return { status: "applied" };
  }

  undo() {
    return this.editingLocked ? { status: "locked" } : this.history.undo();
  }

  redo() {
    return this.editingLocked ? { status: "locked" } : this.history.redo();
  }
}

function isTypingTarget(target) {
  return target?.isContentEditable
    || target?.tagName === "INPUT"
    || target?.tagName === "TEXTAREA"
    || target?.tagName === "SELECT";
}

export function editActionFromKey(event) {
  if (isTypingTarget(event.target)) return null;
  if (event.code === "KeyL" && !event.metaKey && !event.ctrlKey && !event.altKey) {
    return event.repeat ? null : "toggle-lock";
  }
  if (event.code !== "KeyZ" || (!event.metaKey && !event.ctrlKey) || event.altKey) return null;
  return event.shiftKey ? "redo" : "undo";
}
