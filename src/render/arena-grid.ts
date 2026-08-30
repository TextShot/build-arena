import {
  BoxGeometry,
  GridHelper,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
} from "three";

import type { Coordinate } from "../core/coordinates";

export type ArenaGrid = Readonly<{
  group: Group;
  platform: InstancedMesh;
  coordinateFor: (instanceId: number | undefined) => Coordinate | null;
  dispose: () => void;
}>;

export function createArenaGrid(): ArenaGrid {
  const group = new Group();
  group.name = "protected-arena-platform";

  const geometry = new BoxGeometry(0.98, 0.98, 0.98);
  const material = new MeshStandardMaterial({ color: 0x33434d, roughness: 0.9, metalness: 0 });
  const platform = new InstancedMesh(geometry, material, 49);
  const coordinates: Coordinate[] = [];
  const matrix = new Matrix4();

  let instance = 0;
  for (let z = -3; z <= 3; z += 1) {
    for (let x = -3; x <= 3; x += 1) {
      matrix.makeTranslation(x, 0, z);
      platform.setMatrixAt(instance, matrix);
      coordinates.push(Object.freeze({ x, y: 1, z }));
      instance += 1;
    }
  }
  platform.instanceMatrix.needsUpdate = true;
  platform.computeBoundingSphere();
  group.add(platform);

  const grid = new GridHelper(7, 7, 0x6aa9d8, 0x50616d);
  grid.position.y = 0.5;
  group.add(grid);

  return {
    group,
    platform,
    coordinateFor(instanceId) {
      return instanceId === undefined ? null : coordinates[instanceId] ?? null;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
      for (const gridMaterial of gridMaterials) gridMaterial.dispose();
      grid.geometry.dispose();
      group.clear();
    },
  };
}
