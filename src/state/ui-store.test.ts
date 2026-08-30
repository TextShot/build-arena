import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_UI_STATE, useUiStore, type UiState, type UiStore } from "./ui-store";

function pickUiState(store: UiStore): UiState {
  return {
    selectedBlock: store.selectedBlock,
    selectedCoordinate: store.selectedCoordinate,
    cameraPreset: store.cameraPreset,
    sidebarCollapsed: store.sidebarCollapsed,
    activeSidebarPanel: store.activeSidebarPanel,
    jsonMode: store.jsonMode,
    platformSize: store.platformSize,
    buildHeight: store.buildHeight,
  };
}

describe("useUiStore", () => {
  beforeEach(() => {
    useUiStore.getState().resetUiState();
  });

  it("starts with the documented UI defaults", () => {
    expect(pickUiState(useUiStore.getState())).toEqual({
      selectedBlock: "stone",
      selectedCoordinate: null,
      cameraPreset: "iso",
      sidebarCollapsed: true,
      activeSidebarPanel: "layers",
      jsonMode: false,
      platformSize: 51,
      buildHeight: 31,
    });
    expect(pickUiState(useUiStore.getState())).toEqual(DEFAULT_UI_STATE);
  });

  it("updates each field through a named action", () => {
    const { getState } = useUiStore;
    const coordinate = Object.freeze({ x: -1, y: 2, z: 3 });

    getState().setSelectedBlock("oak_planks");
    getState().setSelectedCoordinate(coordinate);
    getState().setCameraPreset("top");
    getState().setSidebarCollapsed(true);
    getState().setActiveSidebarPanel("slider");
    getState().setJsonMode(true);
    getState().setPlatformSize(8);
    getState().setBuildHeight(8);

    expect(pickUiState(getState())).toEqual({
      selectedBlock: "oak_planks",
      selectedCoordinate: { x: -1, y: 2, z: 3 },
      cameraPreset: "top",
      sidebarCollapsed: true,
      activeSidebarPanel: "slider",
      jsonMode: true,
      platformSize: 9,
      buildHeight: 9,
    });

    getState().setPlatformSize(102);
    expect(getState().platformSize).toBe(101);
    getState().setBuildHeight(32);
    expect(getState().buildHeight).toBe(31);
  });

  it("restores defaults with resetUiState", () => {
    const { getState } = useUiStore;

    getState().setSelectedBlock("glass");
    getState().setSelectedCoordinate({ x: 0, y: 1, z: 0 });
    getState().setCameraPreset("right");
    getState().setSidebarCollapsed(true);
    getState().setActiveSidebarPanel("activity");
    getState().setJsonMode(true);
    getState().setPlatformSize(3);
    getState().setBuildHeight(7);
    getState().resetUiState();

    expect(pickUiState(getState())).toEqual(DEFAULT_UI_STATE);
  });

  it("persists sidebar collapsed so a later visit keeps the last state", () => {
    const store: Record<string, string> = {};
    const memory = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const key of Object.keys(store)) delete store[key];
      },
      key: () => null,
      get length() {
        return Object.keys(store).length;
      },
    };

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: memory,
    });

    const { getState } = useUiStore;
    getState().setSidebarCollapsed(false);
    expect(memory.getItem("build-arena.sidebarCollapsed")).toBe("false");
    getState().setSidebarCollapsed(true);
    expect(memory.getItem("build-arena.sidebarCollapsed")).toBe("true");
  });

  it("keeps previous snapshots unchanged after an action", () => {
    const before = useUiStore.getState();

    before.setSelectedBlock("dirt");
    before.setCameraPreset("front");

    const after = useUiStore.getState();

    expect(after).not.toBe(before);
    expect(before.selectedBlock).toBe("stone");
    expect(before.cameraPreset).toBe("iso");
    expect(after.selectedBlock).toBe("dirt");
    expect(after.cameraPreset).toBe("front");
  });

  it("stores a copied coordinate so the input can be mutated later", () => {
    const input = { x: 1, y: 4, z: -2 };

    useUiStore.getState().setSelectedCoordinate(input);
    input.x = 99;
    input.y = 0;

    const stored = useUiStore.getState().selectedCoordinate;
    expect(stored).toEqual({ x: 1, y: 4, z: -2 });
    expect(stored).not.toBe(input);
    expect(Object.isFrozen(stored)).toBe(true);

    useUiStore.getState().setSelectedCoordinate(null);
    expect(useUiStore.getState().selectedCoordinate).toBeNull();
  });
});
