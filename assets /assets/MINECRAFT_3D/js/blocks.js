// blocks.js — Block definitions + redstone signal simulation
// Each block: { name, color, solid(attachable), source(signal source) }

export const BLOCKS = {
  stone:          { name: 'Stone',          color: 0x8a8a8a, solid: true  },
  redstone_wire:  { name: 'Redstone Dust',  color: 0x7a0000, solid: false, wire: true },
  redstone_torch: { name: 'Redstone Torch', color: 0xff3030, solid: false, source: true, torch: true },
  redstone_block: { name: 'Redstone Block', color: 0xc01010, solid: true,  source: true },
  lever:          { name: 'Lever',          color: 0x8b5a2b, solid: false, source: true, toggle: true },
  button:         { name: 'Button',         color: 0x6b4a1b, solid: false, source: true, pulse: true },
  repeater:       { name: 'Repeater',       color: 0xb0b0b0, solid: false, repeater: true },
  comparator:     { name: 'Comparator',     color: 0xc8c8c8, solid: false, comparator: true },
  lamp:           { name: 'Redstone Lamp',  color: 0x4a3a10, solid: false, lamp: true },
  piston:         { name: 'Piston',         color: 0x9a7a40, solid: true,  piston: true },
};

export const BLOCK_IDS = Object.keys(BLOCKS);

const key = (x, y, z) => `${x},${y},${z}`;
const NEIGH = [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0],[0,-1,0]];
// Facing (front points): E=+x, W=-x, N=-z, S=+z
export const FACE = { E:[1,0], W:[-1,0], N:[0,-1], S:[0,1] };
const perp = ([dx,dz]) => [[-dz,dx],[dz,-dx]];   // two perpendicular directions (left/right sides)

// Redstone simulation: compute signal strength (0-15) per block, returns Map<key, power>
// Torch off, repeater/comparator output are interdependent — fixed-point iteration finds stable state.
export function simulate(world) {
  const torchLit = new Map();
  const devOut = new Map();              // repeater/comparator output strength
  for (const [k, b] of world.blocks)
    if (b.id === 'redstone_torch') torchLit.set(k, true);

  let power = new Map();
  for (let iter = 0; iter < 16; iter++) {
    power = computePower(world, torchLit, devOut);
    let changed = false;

    for (const [k] of torchLit) {        // torch: extinguished when support block is powered
      const [x,y,z] = k.split(',').map(Number);
      const below = key(x, y-1, z);
      const lit = !(world.blocks.get(below) && (power.get(below) ?? 0) > 0);
      if (lit !== torchLit.get(k)) { torchLit.set(k, lit); changed = true; }
    }

    for (const [k, b] of world.blocks) { // repeater / comparator: read rear input by facing
      const def = BLOCKS[b.id];
      if (!def.repeater && !def.comparator) continue;
      const [x,y,z] = k.split(',').map(Number);
      const f = FACE[b.facing || 'E'];
      const rear = power.get(key(x-f[0], y, z-f[1])) ?? 0;     // rear is input side
      let out;
      if (def.repeater) {
        out = rear > 0 ? 15 : 0;                               // repeat: boost and max out
      } else {
        const [pa, pb] = perp(f);                             // comparator checks both sides
        const side = Math.max(power.get(key(x+pa[0],y,z+pa[1])) ?? 0,
                              power.get(key(x+pb[0],y,z+pb[1])) ?? 0);
        out = b.mode === 'subtract' ? Math.max(0, rear - side)// subtract mode
                                    : (side > rear ? 0 : rear);// compare mode
      }
      if ((devOut.get(k) ?? 0) !== out) { devOut.set(k, out); changed = true; }
    }
    if (!changed) break;
  }
  return power;
}

// Given torch state + repeater/comparator output, compute full-map signal strength
function computePower(world, torchLit, devOut) {
  const power = new Map();
  const queue = [];

  for (const [k, b] of world.blocks) {     // signal sources
    const def = BLOCKS[b.id];
    if (!def?.source) continue;
    const [x,y,z] = k.split(',').map(Number);
    if (def.torch) {
      if (!torchLit.get(k)) continue;
      power.set(k, 15);
      for (const [dx,dy,dz] of NEIGH)
        if (!(dx===0 && dy===-1 && dz===0)) queue.push([x+dx, y+dy, z+dz, 15]);
    } else {
      if ((def.toggle || def.pulse) && !b.on) continue;
      power.set(k, 15);
      for (const [dx,dy,dz] of NEIGH) queue.push([x+dx, y+dy, z+dz, 15]);
    }
  }

  for (const [k, b] of world.blocks) {     // repeater/comparator inject output from "front"
    const def = BLOCKS[b.id];
    if (!def.repeater && !def.comparator) continue;
    const out = devOut.get(k) ?? 0;
    const [x,y,z] = k.split(',').map(Number);
    power.set(k, out);                      // component brightness = its output
    if (out > 0) { const f = FACE[b.facing || 'E']; queue.push([x+f[0], y, z+f[1], out]); }
  }

  bfs(world, power, queue);
  return power;
}

function bfs(world, power, queue) {
  while (queue.length) {
    const [x,y,z,p] = queue.shift();
    if (p <= 0) continue;
    const here = world.blocks.get(key(x,y,z));
    if (!here) continue;
    const def = BLOCKS[here.id];
    // signal sources/repeaters/comparators are "endpoints": external signals don't pass through
    if (def?.source || def?.repeater || def?.comparator) continue;
    if ((power.get(key(x,y,z)) ?? 0) >= p) continue;
    power.set(key(x,y,z), p);
    if (def?.wire || def?.solid) {          // redstone dust/solid blocks propagate outward with decay
      for (const [dx,dy,dz] of NEIGH) {
        const nx=x+dx, ny=y+dy, nz=z+dz;
        const nb = world.blocks.get(key(nx,ny,nz));
        if (!nb) continue;
        if ((power.get(key(nx,ny,nz)) ?? 0) < p - 1) queue.push([nx,ny,nz,p-1]);
      }
    }
    // lamp / piston: receive only, do not propagate
  }
}
