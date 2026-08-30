import { BoxGeometry, Mesh, MeshBasicMaterial } from "three";

import type { Coordinate } from "../core/coordinates";

export class SelectionHighlight {
  readonly mesh: Mesh;

  private readonly geometry = new BoxGeometry(1.04, 1.04, 1.04);
  private readonly material = new MeshBasicMaterial({
    color: 0xf4c95d,
    transparent: true,
    opacity: 0.92,
    wireframe: true,
    depthTest: false,
  });

  constructor() {
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = "selected-coordinate";
    this.mesh.visible = false;
    this.mesh.renderOrder = 10;
  }

  setCoordinate(coordinate: Coordinate | null): void {
    this.mesh.visible = coordinate !== null;
    if (coordinate) this.mesh.position.set(coordinate.x, coordinate.y, coordinate.z);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
  }
}
