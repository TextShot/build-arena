import { describe, expect, it } from "vitest";

import { arenaBlockToPlaceOpts, worldCoord } from "./transplant";

describe("transplant", () => {
  it("maps Arena (2,1,5) at origin (0,0,0) onto grass y=0", () => {
    expect(worldCoord({ x: 2, y: 1, z: 5 }, { x: 0, y: 0, z: 0 })).toEqual({ x: 2, y: 0, z: 5 });
  });

  it("maps Arena west facing to Play Space W", () => {
    expect(arenaBlockToPlaceOpts({ state: { facing: "west" } }).facing).toBe("W");
  });
});
