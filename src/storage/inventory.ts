import type { Block, BlockId, BlockState } from "../core/block-types";
import { isBlockId, isFacing } from "../core/block-types";

export const INVENTORY_KEY = "build-arena.inventory.v1";
export const HANDOFF_KEY = "build-arena.handoff.v1";
export const INVENTORY_LIMIT = 20;

export type InventoryBlock = Readonly<{
  x: number;
  y: number;
  z: number;
  block: BlockId;
  state?: BlockState;
}>;

export type InventoryEntry = Readonly<{
  id: string;
  name: string;
  createdAt: string;
  platformSize: number;
  buildHeight: number;
  thumbnail: string;
  blocks: readonly InventoryBlock[];
}>;

export type InventoryFile = Readonly<{
  version: 1;
  entries: readonly InventoryEntry[];
}>;

export type Handoff = Readonly<{
  kind: "visit" | "place";
  platformSize: number;
  buildHeight: number;
  blocks?: readonly InventoryBlock[];
}>;

export type StorageWrite = Readonly<{ ok: true }> | Readonly<{ ok: false; error: string }>;

const EMPTY_FILE: InventoryFile = Object.freeze({ version: 1, entries: [] });
const QUOTA_ERROR = "Inventory is full (browser storage quota)";

export function toRelativeBlocks(blocks: readonly Block[]): InventoryBlock[] {
  if (blocks.length === 0) return [];
  let minX = blocks[0].position.x;
  let minZ = blocks[0].position.z;
  for (const block of blocks) {
    if (block.position.x < minX) minX = block.position.x;
    if (block.position.z < minZ) minZ = block.position.z;
  }
  return blocks.map((block) => {
    const relative: InventoryBlock = {
      x: block.position.x - minX,
      y: block.position.y,
      z: block.position.z - minZ,
      block: block.block,
    };
    return block.state ? Object.freeze({ ...relative, state: block.state }) : Object.freeze(relative);
  });
}

export function readInventory(): InventoryFile {
  try {
    const raw = localStorage.getItem(INVENTORY_KEY);
    if (!raw) return EMPTY_FILE;
    return parseInventoryFile(JSON.parse(raw)) ?? EMPTY_FILE;
  } catch {
    return EMPTY_FILE;
  }
}

export function writeInventory(file: InventoryFile): StorageWrite {
  try {
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(file));
    return { ok: true };
  } catch {
    return { ok: false, error: QUOTA_ERROR };
  }
}

export function addEntry(
  entryWithoutId: Omit<InventoryEntry, "id" | "createdAt">,
): { ok: true; entry: InventoryEntry } | { ok: false; error: string } {
  const entry: InventoryEntry = Object.freeze({
    ...entryWithoutId,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    blocks: Object.freeze([...entryWithoutId.blocks]),
  });
  const current = readInventory();
  const entries = [entry, ...current.entries].slice(0, INVENTORY_LIMIT);
  const written = writeInventory({ version: 1, entries });
  if (!written.ok) return written;
  return { ok: true, entry };
}

export function removeEntry(id: string): StorageWrite {
  const current = readInventory();
  return writeInventory({
    version: 1,
    entries: current.entries.filter((entry) => entry.id !== id),
  });
}

export function writeHandoff(handoff: Handoff): StorageWrite {
  try {
    localStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
    return { ok: true };
  } catch {
    return { ok: false, error: QUOTA_ERROR };
  }
}

export function readAndClearHandoff(): Handoff | null {
  try {
    const raw = localStorage.getItem(HANDOFF_KEY);
    localStorage.removeItem(HANDOFF_KEY);
    if (!raw) return null;
    return parseHandoff(JSON.parse(raw));
  } catch {
    try {
      localStorage.removeItem(HANDOFF_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

function isSafeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function parseInventoryFile(value: unknown): InventoryFile | null {
  if (value === null || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || !Array.isArray(record.entries)) return null;
  const entries: InventoryEntry[] = [];
  for (const item of record.entries) {
    const entry = parseEntry(item);
    if (!entry) return null;
    entries.push(entry);
  }
  return { version: 1, entries };
}

function parseEntry(value: unknown): InventoryEntry | null {
  if (value === null || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.name !== "string") return null;
  if (typeof record.createdAt !== "string" || typeof record.thumbnail !== "string") return null;
  if (!isSafeInt(record.platformSize) || !isSafeInt(record.buildHeight)) return null;
  if (!Array.isArray(record.blocks)) return null;
  const blocks: InventoryBlock[] = [];
  for (const item of record.blocks) {
    const block = parseInventoryBlock(item);
    if (!block) return null;
    blocks.push(block);
  }
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    platformSize: record.platformSize,
    buildHeight: record.buildHeight,
    thumbnail: record.thumbnail,
    blocks,
  };
}

function parseInventoryBlock(value: unknown): InventoryBlock | null {
  if (value === null || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!isSafeInt(record.x) || !isSafeInt(record.y) || !isSafeInt(record.z)) return null;
  if (!isBlockId(record.block)) return null;
  const block: InventoryBlock = { x: record.x, y: record.y, z: record.z, block: record.block };
  if (record.state === undefined) return block;
  const state = parseState(record.state);
  if (!state) return null;
  return { ...block, state };
}

function parseState(value: unknown): BlockState | null {
  if (value === null || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.facing !== undefined && !isFacing(record.facing)) return null;
  if (record.mode !== undefined && record.mode !== "compare" && record.mode !== "subtract") return null;
  if (record.half !== undefined && record.half !== "top" && record.half !== "bottom") return null;
  if (record.open !== undefined && typeof record.open !== "boolean") return null;
  if (record.shape !== undefined && record.shape !== "straight") return null;
  return {
    ...(isFacing(record.facing) ? { facing: record.facing } : {}),
    ...(record.mode === "compare" || record.mode === "subtract" ? { mode: record.mode } : {}),
    ...(record.half === "top" || record.half === "bottom" ? { half: record.half } : {}),
    ...(typeof record.open === "boolean" ? { open: record.open } : {}),
    ...(record.shape === "straight" ? { shape: "straight" as const } : {}),
  };
}

function parseHandoff(value: unknown): Handoff | null {
  if (value === null || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.kind !== "visit" && record.kind !== "place") return null;
  if (!isSafeInt(record.platformSize) || !isSafeInt(record.buildHeight)) return null;
  if (record.kind === "visit") {
    return { kind: "visit", platformSize: record.platformSize, buildHeight: record.buildHeight };
  }
  if (!Array.isArray(record.blocks)) return null;
  const blocks: InventoryBlock[] = [];
  for (const item of record.blocks) {
    const block = parseInventoryBlock(item);
    if (!block) return null;
    blocks.push(block);
  }
  return { kind: "place", platformSize: record.platformSize, buildHeight: record.buildHeight, blocks };
}
