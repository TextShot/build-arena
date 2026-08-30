import { create } from "zustand";

import type { BlockId } from "../core/block-types";
import type { Coordinate } from "../core/coordinates";
import { MAX_BUILD_HEIGHT, MAX_PLATFORM_SIZE, MIN_PLATFORM_SIZE } from "../core/arena-config";

export type CameraPreset = "iso" | "top" | "front" | "right";
export type SidebarPanel = "layers" | "activity" | "slider";

const SIDEBAR_COLLAPSED_KEY = "build-arena.sidebarCollapsed";

export type UiState = Readonly<{
  selectedBlock: BlockId;
  selectedCoordinate: Coordinate | null;
  cameraPreset: CameraPreset;
  sidebarCollapsed: boolean;
  activeSidebarPanel: SidebarPanel;
  jsonMode: boolean;
  /** Odd square platform width shared by X and Z. */
  platformSize: number;
  /** Highest buildable Y layer. */
  buildHeight: number;
}>;

export type UiActions = Readonly<{
  setSelectedBlock: (selectedBlock: BlockId) => void;
  setSelectedCoordinate: (selectedCoordinate: Coordinate | null) => void;
  setCameraPreset: (cameraPreset: CameraPreset) => void;
  setSidebarCollapsed: (sidebarCollapsed: boolean) => void;
  setActiveSidebarPanel: (activeSidebarPanel: SidebarPanel) => void;
  setJsonMode: (jsonMode: boolean) => void;
  setPlatformSize: (platformSize: number) => void;
  setBuildHeight: (buildHeight: number) => void;
  resetUiState: () => void;
}>;

export type UiStore = UiState & UiActions;

export const DEFAULT_UI_STATE: UiState = Object.freeze({
  selectedBlock: "stone",
  selectedCoordinate: null,
  cameraPreset: "iso",
  sidebarCollapsed: false,
  activeSidebarPanel: "layers",
  jsonMode: false,
  platformSize: 51,
  buildHeight: 31,
});

function readPersistedCollapsed(): boolean {
  try {
    const raw = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    /* ignore quota / private-mode failures */
  }
  return DEFAULT_UI_STATE.sidebarCollapsed;
}

function persistCollapsed(sidebarCollapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  } catch {
    /* ignore quota / private-mode failures */
  }
}

function snapOdd(value: number, minimum: number, maximum: number): number {
  const rounded = Math.round(value);
  const odd = rounded % 2 === 0 ? rounded + 1 : rounded;
  return Math.min(maximum, Math.max(minimum, odd));
}

function copyCoordinate(coordinate: Coordinate | null): Coordinate | null {
  if (coordinate === null) {
    return null;
  }

  return Object.freeze({ x: coordinate.x, y: coordinate.y, z: coordinate.z });
}

export const useUiStore = create<UiStore>()((set) => ({
  ...DEFAULT_UI_STATE,
  sidebarCollapsed: readPersistedCollapsed(),
  setSelectedBlock: (selectedBlock) => set({ selectedBlock }),
  setSelectedCoordinate: (selectedCoordinate) =>
    set({ selectedCoordinate: copyCoordinate(selectedCoordinate) }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setSidebarCollapsed: (sidebarCollapsed) => {
    persistCollapsed(sidebarCollapsed);
    set({ sidebarCollapsed });
  },
  setActiveSidebarPanel: (activeSidebarPanel) => set({ activeSidebarPanel }),
  setJsonMode: (jsonMode) => set({ jsonMode }),
  setPlatformSize: (platformSize) => set({
    platformSize: snapOdd(platformSize, MIN_PLATFORM_SIZE, MAX_PLATFORM_SIZE),
  }),
  setBuildHeight: (buildHeight) => set({
    buildHeight: snapOdd(buildHeight, 7, MAX_BUILD_HEIGHT),
  }),
  resetUiState: () => {
    persistCollapsed(DEFAULT_UI_STATE.sidebarCollapsed);
    set({ ...DEFAULT_UI_STATE });
  },
}));
