// textures.js — Block materials: load assets/*.png hand-drawn pixel textures + procedural redstone dust connections
import * as THREE from '../vendor/three.module.js';

const S = 16;
const matCache = new Map();
const texCache = new Map();
const loader = new THREE.TextureLoader();

function canvas() { const c = document.createElement('canvas'); c.width = c.height = S; return c; }
const px = (ctx,x,y,c)=>{ ctx.fillStyle=c; ctx.fillRect(x,y,1,1); };

// Load PNG textures (NearestFilter keeps pixel look), with cache
function loadTex(name) {
  if (texCache.has(name)) return texCache.get(name);
  const t = loader.load(`assets/${name}.png`);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(name, t);
  return t;
}

// Procedural redstone dust texture (draw cross lines by NSEW connection shape, transparent background)
function dustTexture(shape) {
  const name = 'dust_'+shape;
  if (texCache.has(name)) return texCache.get(name);
  const c = canvas(); const ctx = c.getContext('2d');
  ctx.clearRect(0,0,S,S);
  const armH = (x,w)=>{ ctx.fillStyle='#7a0000'; ctx.fillRect(x,6,w,4);
                        ctx.fillStyle='#cc1c1c'; ctx.fillRect(x,7,w,2); };
  const armV = (y,h)=>{ ctx.fillStyle='#7a0000'; ctx.fillRect(6,y,4,h);
                        ctx.fillStyle='#cc1c1c'; ctx.fillRect(7,y,2,h); };
  if (shape.includes('N')) armV(0,8);
  if (shape.includes('S')) armV(8,8);
  if (shape.includes('W')) armH(0,8);
  if (shape.includes('E')) armH(8,8);
  if (shape==='') { armH(4,8); armV(4,8); }
  ctx.fillStyle='#7a0000'; ctx.fillRect(6,6,4,4);
  ctx.fillStyle='#e23030'; ctx.fillRect(7,7,2,2);
  px(ctx,7,7,'#ff6a6a');
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  texCache.set(name, t); return t;
}
export function dustMaterial(shape) {
  const k = 'dustmat_'+shape;
  if (matCache.has(k)) return matCache.get(k);
  const m = new THREE.MeshStandardMaterial({ map: dustTexture(shape), transparent:true, emissive:0x000000 });
  matCache.set(k, m); return m;
}

// Get block material (returns single material or 6-face array: [+x,-x,+y,-y,+z,-z])
export function faceMaterials(id, lit=false) {
  const k = id + (lit?'_lit':'');
  if (matCache.has(k)) return matCache.get(k);
  const M = (name) => new THREE.MeshStandardMaterial({ map: loadTex(name) });
  let res;
  switch (id) {
    case 'grass':   { const s=M('grass_side'), t=M('grass_top'), b=M('dirt'); res=[s,s,t,b,s,s]; break; }
    case 'piston':  { const s=M('piston_side'), t=M('piston_top'); res=[s,s,t,s,s,s]; break; }
    case 'repeater':{ const s=M('repeater_side'), t=M('repeater_top'); res=[s,s,t,s,s,s]; break; }
    case 'comparator':{ const s=M('repeater_side'), t=M('comparator_top'); res=[s,s,t,s,s,s]; break; }
    case 'lamp': {
      const map = loadTex(lit?'lamp_on':'lamp_off');
      res = new THREE.MeshStandardMaterial({ map,
        emissive: new THREE.Color(lit?0xffcc44:0x000000),
        emissiveMap: lit?map:null, emissiveIntensity: lit?1.4:0 });
      break; }
    case 'redstone_block': res = M('redstone_block'); break;
    case 'stone': default: res = M('stone'); break;
  }
  matCache.set(k, res); return res;
}

// Hotbar icon: draw PNG (or redstone component sketch) onto 32px canvas
const ICON_PNG = { stone:'stone', grass:'grass_side', redstone_block:'redstone_block',
  piston:'piston_side', repeater:'repeater_top', comparator:'comparator_top', lamp:'lamp_off' };
export function iconCanvas(id) {
  const out = document.createElement('canvas'); out.width = out.height = 32;
  const o = out.getContext('2d'); o.imageSmoothingEnabled = false;
  if (ICON_PNG[id]) {                                   // use PNG texture as icon
    const img = new Image();
    img.onload = () => { o.imageSmoothingEnabled=false; o.drawImage(img,0,0,32,32); };
    img.src = `assets/${ICON_PNG[id]}.png`;
    return out;
  }
  // redstone components (dust/torch/lever/button) use simple pixel sketch
  const c = canvas(); const ctx = c.getContext('2d');
  if (id==='redstone_wire'){ ctx.clearRect(0,0,S,S); ctx.fillStyle='#a30000'; ctx.fillRect(6,0,4,S); ctx.fillRect(0,6,S,4); }
  else if (id==='redstone_torch'){ ctx.fillStyle='#6b4a25'; ctx.fillRect(7,7,2,8); ctx.fillStyle='#ff3b3b'; ctx.fillRect(6,2,4,4); }
  else if (id==='lever'){ ctx.fillStyle='#8a8a8a'; ctx.fillRect(2,9,12,5); ctx.fillStyle='#9a6a3a'; ctx.fillRect(7,2,2,9); }
  else if (id==='button'){ ctx.fillStyle='#808080'; ctx.fillRect(0,0,S,S); ctx.fillStyle='#777'; ctx.fillRect(4,6,8,4); }
  o.drawImage(c, 0, 0, 32, 32);
  return out;
}
