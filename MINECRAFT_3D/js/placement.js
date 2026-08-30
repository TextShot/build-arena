import * as THREE from "../vendor/three.module.js";

const MAX_BUILD_HEIGHT = 31;

// keep in sync with src/storage/transplant.ts
export const ARENA_TO_WORLD_FACING = { north: "N", east: "E", south: "S", west: "W" };

export function arenaBlockToPlaceOpts(block) {
  const facing = block.state?.facing ? ARENA_TO_WORLD_FACING[block.state.facing] : undefined;
  const mode = block.state?.mode;
  return { facing, mode };
}

export function worldCoord(block, origin) {
  return {
    x: origin.x + block.x,
    y: block.y - 1,
    z: origin.z + block.z,
  };
}

export function originFromPick(pick) {
  const p = pick.placeAt;
  return { x: p[0], y: p[1], z: p[2] };
}

export function placeBlocksAtOrigin(world, blocks, origin) {
  let applied = 0;
  let skipped = 0;
  for (const block of blocks) {
    const c = worldCoord(block, origin);
    if (Math.abs(c.x) > world.radius || Math.abs(c.z) > world.radius || c.y < 0 || c.y > MAX_BUILD_HEIGHT) {
      skipped++;
      continue;
    }
    if (world.place(c.x, c.y, c.z, block.block, arenaBlockToPlaceOpts(block)) === true) applied++;
    else skipped++;
  }
  return { applied, skipped };
}

export function commitPlacement(
  world,
  blocks,
  { canCommit = () => true, onBlocked = () => {} } = {},
) {
  if (!canCommit()) {
    onBlocked();
    return { status: "blocked" };
  }
  const pick = world.pickCenter();
  if (!pick) return { status: "no-target" };
  const { applied, skipped } = placeBlocksAtOrigin(world, blocks, originFromPick(pick));
  return { status: "applied", applied, skipped };
}

let activeSession = null;

export function isPlacing() {
  return Boolean(activeSession);
}

export function cancelPlacement() {
  activeSession?.cancel();
}

export function startPlacement(world, blocks, options) {
  cancelPlacement();
  if (!blocks?.length) return null;

  const ghost = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  for (const block of blocks) {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    cube.position.set(block.x, block.y - 1, block.z);
    ghost.add(cube);
  }
  world.scene.add(ghost);

  let ignoreNext = true;
  let active = true;

  world.onFrame = () => {
    if (!active) return;
    const pick = world.pickCenter();
    if (!pick) {
      ghost.visible = false;
      return;
    }
    const origin = originFromPick(pick);
    ghost.visible = true;
    ghost.position.set(origin.x, 0, origin.z);
  };

  function finish() {
    if (!active) return;
    active = false;
    world.onFrame = null;
    world.scene.remove(ghost);
    ghost.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
    });
    mat.dispose();
    removeEventListener("mousedown", onMouseDown, true);
    removeEventListener("keydown", onKeyDown);
    if (activeSession === session) activeSession = null;
  }

  function commit() {
    const result = commitPlacement(world, blocks, options);
    if (result.status === "applied") finish();
  }

  function onMouseDown(event) {
    if (!active) return;
    if (ignoreNext) {
      ignoreNext = false;
      return;
    }
    if (!world.locked()) return;
    if (event.button === 0) {
      event.stopImmediatePropagation();
      event.preventDefault();
      commit();
    }
  }

  function onKeyDown(event) {
    if (!active) return;
    if (event.code === "Escape") {
      event.preventDefault();
      finish();
    }
  }

  addEventListener("mousedown", onMouseDown, true);
  addEventListener("keydown", onKeyDown);

  const session = { cancel: finish, commit };
  activeSession = session;
  return session;
}
