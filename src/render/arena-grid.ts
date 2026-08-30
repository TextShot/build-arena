import {
  BoxGeometry,
  GridHelper,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
} from "three";

import type { Coordinate } from "../core/coordinates";
import type { ArenaConfig } from "../core/arena-config";

export type ArenaGrid = Readonly<{
  group: Group;
  platform: InstancedMesh;
  coordinateFor: (instanceId: number | undefined) => Coordinate | null;
  dispose: () => void;
}>;

export function createArenaGrid(config: ArenaConfig): ArenaGrid {
  const group = new Group();
  group.name = "protected-arena-platform";

  const geometry = new BoxGeometry(0.98, 0.98, 0.98);
  const grassTop = new MeshStandardMaterial({ color: 0x5d9c46, roughness: 0.94, metalness: 0 });
  const dirt = new MeshStandardMaterial({ color: 0x866043, roughness: 0.96, metalness: 0 });
  const materials = [dirt, dirt, grassTop, dirt, dirt, dirt];
  const platformSize = config.maxX - config.minX + 1;
  const platform = new InstancedMesh(geometry, materials, platformSize * platformSize);
  const coordinates: Coordinate[] = [];
  const matrix = new Matrix4();

  let instance = 0;
  for (let z = config.minZ; z <= config.maxZ; z += 1) {
    for (let x = config.minX; x <= config.maxX; x += 1) {
      matrix.makeTranslation(x, config.platformY, z);
      platform.setMatrixAt(instance, matrix);
      coordinates.push(Object.freeze({ x, y: config.platformY + 1, z }));
      instance += 1;
    }
  }
  platform.instanceMatrix.needsUpdate = true;
  platform.computeBoundingSphere();
  group.add(platform);

  const grid = new GridHelper(platformSize, platformSize, 0xd7e8a0, 0x3d6b32);
  grid.position.y = config.platformY + 0.5;
  group.add(grid);

  return {
    group,
    platform,
    coordinateFor(instanceId) {
      return instanceId === undefined ? null : coordinates[instanceId] ?? null;
    },
    dispose() {
      geometry.dispose();
      grassTop.dispose();
      dirt.dispose();
      const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
      for (const gridMaterial of gridMaterials) gridMaterial.dispose();
      grid.geometry.dispose();
      group.clear();
    },
  };
}
