import { create } from "zustand";

import type { BlockId } from "../core/block-types";
import type { Coordinate } from "../core/coordinates";

export type CameraPreset = "iso" | "top" | "front" | "right";
export type SidebarPanel = "controls" | "layers" | "json" | "activity";

export type UiState = Readonly<{
  selectedBlock: BlockId;
  selectedCoordinate: Coordinate | null;
  cameraPreset: CameraPreset;
  sidebarCollapsed: boolean;
  activeSidebarPanel: SidebarPanel;
}>;

export type UiActions = Readonly<{
  setSelectedBlock: (selectedBlock: BlockId) => void;
  setSelectedCoordinate: (selectedCoordinate: Coordinate | null) => void;
  setCameraPreset: (cameraPreset: CameraPreset) => void;
  setSidebarCollapsed: (sidebarCollapsed: boolean) => void;
  setActiveSidebarPanel: (activeSidebarPanel: SidebarPanel) => void;
  resetUiState: () => void;
}>;

export type UiStore = UiState & UiActions;

export const DEFAULT_UI_STATE: UiState = Object.freeze({
  selectedBlock: "stone",
  selectedCoordinate: null,
  cameraPreset: "iso",
  sidebarCollapsed: true,
  activeSidebarPanel: "controls",
});

function copyCoordinate(coordinate: Coordinate | null): Coordinate | null {
  if (coordinate === null) {
    return null;
  }

  return Object.freeze({ x: coordinate.x, y: coordinate.y, z: coordinate.z });
}

export const useUiStore = create<UiStore>()((set) => ({
  ...DEFAULT_UI_STATE,
  setSelectedBlock: (selectedBlock) => set({ selectedBlock }),
  setSelectedCoordinate: (selectedCoordinate) =>
    set({ selectedCoordinate: copyCoordinate(selectedCoordinate) }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setActiveSidebarPanel: (activeSidebarPanel) => set({ activeSidebarPanel }),
  resetUiState: () => set({ ...DEFAULT_UI_STATE }),
}));
