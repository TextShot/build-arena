import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addEntry,
  HANDOFF_KEY,
  INVENTORY_KEY,
  readAndClearHandoff,
  readInventory,
  toRelativeBlocks,
  writeHandoff,
} from "./inventory";

function installMemoryStorage() {
  const store = new Map<string, string>();
  const memory = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: memory });
}

describe("inventory", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("shifts blocks to the min X/Z corner and keeps Arena Y", () => {
    expect(toRelativeBlocks([
      { position: { x: 2, y: 1, z: 5 }, block: "stone" },
      { position: { x: 3, y: 2, z: 5 }, block: "glass" },
    ])).toEqual([
      { x: 0, y: 1, z: 0, block: "stone" },
      { x: 1, y: 2, z: 0, block: "glass" },
    ]);
  });

  it("returns no blocks for an empty world", () => {
    expect(toRelativeBlocks([])).toEqual([]);
  });

  it("round-trips an added entry", () => {
    const written = addEntry({
      name: "Build 1",
      platformSize: 51,
      buildHeight: 31,
      thumbnail: "data:image/jpeg;base64,xx",
      blocks: [{ x: 0, y: 1, z: 0, block: "stone" }],
    });
    expect(written.ok).toBe(true);
    const file = readInventory();
    expect(file.version).toBe(1);
    expect(file.entries).toHaveLength(1);
    expect(file.entries[0]).toMatchObject({
      name: "Build 1",
      platformSize: 51,
      blocks: [{ x: 0, y: 1, z: 0, block: "stone" }],
    });
  });

  it("treats corrupt JSON as an empty shelf", () => {
    localStorage.setItem(INVENTORY_KEY, "{not-json");
    expect(readInventory()).toEqual({ version: 1, entries: [] });
  });

  it("drops the oldest entry after twenty saves", () => {
    for (let index = 0; index < 21; index += 1) {
      addEntry({
        name: `Build ${index}`,
        platformSize: 7,
        buildHeight: 6,
        thumbnail: "",
        blocks: [{ x: 0, y: 1, z: 0, block: "stone" }],
      });
    }
    const names = readInventory().entries.map((entry) => entry.name);
    expect(names).toHaveLength(20);
    expect(names[0]).toBe("Build 20");
    expect(names).not.toContain("Build 0");
  });

  it("clears a handoff after the first read", () => {
    expect(writeHandoff({ kind: "visit", platformSize: 51, buildHeight: 31 })).toEqual({ ok: true });
    expect(readAndClearHandoff()).toEqual({ kind: "visit", platformSize: 51, buildHeight: 31 });
    expect(readAndClearHandoff()).toBeNull();
    expect(localStorage.getItem(HANDOFF_KEY)).toBeNull();
  });
});
