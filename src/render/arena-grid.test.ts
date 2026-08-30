import { describe, expect, it } from "vitest";

import { createArenaConfig } from "../core/arena-config";
import { createArenaGrid } from "./arena-grid";

describe("arena grid", () => {
  it("creates a clickable platform cell for every coordinate at size 101", () => {
    const grid = createArenaGrid(createArenaConfig(101));

    expect(grid.platform.count).toBe(10_201);
    expect(grid.coordinateFor(0)).toEqual({ x: -50, y: 1, z: -50 });
    expect(grid.coordinateFor(10_200)).toEqual({ x: 50, y: 1, z: 50 });

    grid.dispose();
  });
});
