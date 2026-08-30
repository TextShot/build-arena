// world.js — First-person voxel world: grass terrain + per-face textures + block outline + break particles + redstone
import * as THREE from '../vendor/three.module.js';
import { PointerLockControls } from '../vendor/PointerLockControls.js';
import { BLOCKS, simulate } from './blocks.js';
import { applyLookDelta, lookDeltaFromKeys } from './look.js';
import { faceMaterials, dustMaterial } from './textures.js';

const key = (x, y, z) => `${x},${y},${z}`;
const DIRS = [['E',1,0],['W',-1,0],['N',0,-1],['S',0,1]];   // redstone dust four-way connections
// facing -> Y rotation angle (model local +x is front)
const FACE_ANGLE = { E:0, S:-Math.PI/2, W:Math.PI, N:Math.PI/2 };
const FACE_OK = f => f==='E'||f==='W'||f==='N'||f==='S';

export class World {
  constructor(canvas, platformSize = 51) {
    this.canvas = canvas;
    this.blocks = new Map();
    this.meshes = new Map();
    this.blockRevisions = new Map();
    this.nextBlockRevision = 1;
    this.displayLampKeys = new Set();
    this.power  = new Map();
    this.particles = [];
    this.onFrame = null;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8cc5ff);
    this.scene.fog = new THREE.Fog(0x8cc5ff, 40, 110);
    this.camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(devicePixelRatio);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const sun = new THREE.DirectionalLight(0xffffff, 0.7);
    sun.position.set(30, 60, 20); this.scene.add(sun);
    this._clouds();
    const sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(12,12),
      new THREE.MeshBasicMaterial({ color:0xfff6c0, fog:false }));
    sunDisc.position.set(40, 55, -60); this.scene.add(sunDisc);

    this.cube = new THREE.BoxGeometry(1, 1, 1);
    this._terrain(platformSize);
    this.raycaster = new THREE.Raycaster();

    // black outline on selected block (classic highlight)
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002,1.002,1.002)),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent:true, opacity:0.4 }));
    this.highlight.visible = false; this.scene.add(this.highlight);

    this.controls = new PointerLockControls(this.camera, document.body);
    this.controls.getObject().position.set(2, 1.8, 7);
    this.scene.add(this.controls.getObject());
    this.interaction = new EventTarget();
    this.fallbackAvailable = false;
    this.fallbackActive = false;
    this.fallbackDragging = false;
    this.pendingFallback = null;
    this.controls.addEventListener('lock', () => {
      clearTimeout(this.pendingFallback);
      this.fallbackActive = false;
      this.interaction.dispatchEvent(new Event('lock'));
    });
    this.controls.addEventListener('unlock', () => {
      if (!this.fallbackActive) this.interaction.dispatchEvent(new Event('unlock'));
    });
    document.addEventListener('pointerlockerror', () => {
      this.fallbackAvailable = true;
      this._activateFallback();
    });
    canvas.addEventListener('mousedown', (event) => {
      if (!this.fallbackActive || !event.altKey || event.button !== 0) return;
      this.fallbackDragging = true;
      event.preventDefault();
      event.stopPropagation();
    });
    addEventListener('mousemove', (event) => {
      if (!this.fallbackDragging) return;
      applyLookDelta(this.camera, -event.movementX * 0.003, -event.movementY * 0.003);
    });
    addEventListener('mouseup', (event) => {
      if (event.button === 0) this.fallbackDragging = false;
    });
    this.keys = {};
    addEventListener('keydown', e => {
      if (document.activeElement.tagName === 'TEXTAREA') return;
      if (e.code.startsWith('Arrow')) e.preventDefault();
      this.keys[e.code] = true;
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth/innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    this.clock = new THREE.Clock();
    this._loop();
  }

  locked(){ return this.controls.isLocked || this.fallbackActive; }

  _markBlockChanged(k) {
    this.blockRevisions.set(k, this.nextBlockRevision++);
  }

  _activateFallback() {
    if (this.controls.isLocked || this.fallbackActive) return;
    this.fallbackActive = true;
    this.interaction.dispatchEvent(new Event('lock'));
  }

  lock() {
    if (this.fallbackAvailable) {
      this._activateFallback();
      return;
    }
    this.controls.lock();
    clearTimeout(this.pendingFallback);
    this.pendingFallback = setTimeout(() => {
      if (!this.controls.isLocked) {
        this.fallbackAvailable = true;
        this._activateFallback();
      }
    }, 200);
  }

  unlock() {
    clearTimeout(this.pendingFallback);
    if (this.controls.isLocked) {
      this.controls.unlock();
      return;
    }
    if (this.fallbackActive) {
      this.fallbackActive = false;
      this.fallbackDragging = false;
      this.interaction.dispatchEvent(new Event('unlock'));
    }
  }

  _terrain(platformSize) {
    const size = (Number.isInteger(platformSize) && platformSize % 2 === 1 && platformSize >= 7 && platformSize <= 101)
      ? platformSize
      : 51;
    if (size !== platformSize) console.log("platformSize must be odd 7–101; using 51");
    const radius = (size - 1) / 2;
    this.platformSize = size;
    this.radius = radius;
    this.N = size;
    const count = size * size;
    const grass = new THREE.InstancedMesh(this.cube, faceMaterials("grass"), count);
    const m = new THREE.Matrix4();
    let i = 0;
    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        m.setPosition(x, -1, z);
        grass.setMatrixAt(i++, m);
      }
    }
    grass.instanceMatrix.needsUpdate = true;
    this.scene.add(grass);
    this.ground = grass;
    // dirt depth below grass layer (gives world edges thickness instead of a floating single layer)
    const dirtTex = faceMaterials("grass")[3].map;
    const dirtMat = new THREE.MeshStandardMaterial({ map: dirtTex });
    dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping;
    const dirt = new THREE.Mesh(new THREE.BoxGeometry(size, 6, size), dirtMat);
    dirt.position.set(0, -4.5, 0); this.scene.add(dirt);
  }

  _clouds() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.85 });
    for (let i=0;i<14;i++){
      const w=4+Math.random()*8, d=4+Math.random()*8;
      const c = new THREE.Mesh(new THREE.BoxGeometry(w,1,d), mat);
      c.position.set(Math.random()*120-30, 30+Math.random()*8, Math.random()*120-30);
      g.add(c);
    }
    this.scene.add(g); this.clouds = g;
  }

  // build geometry by block type (redstone components have dedicated models)
  _build(id) {
    const def = BLOCKS[id];
    if (def.wire) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.98,0.06,0.98), dustMaterial('NSEW'));
      m.userData.dust = true; return m;
    }
    if (def.torch) {
      const g = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.6,0.12),
        new THREE.MeshStandardMaterial({ color:0x6b4a25 }));
      stick.position.y = -0.2; g.add(stick);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.2),
        new THREE.MeshStandardMaterial({ color:0xff3b3b, emissive:0x551010 }));
      tip.position.y = 0.18; tip.userData.tip = true; g.add(tip);
      return g;
    }
    if (id === 'lever') {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.18,0.34),
        new THREE.MeshStandardMaterial({ color:0x8a8a8a }));
      base.position.y = -0.41; g.add(base);
      const lvr = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.42,0.1),
        new THREE.MeshStandardMaterial({ color:0x9a6a3a }));
      lvr.position.y = -0.24; lvr.rotation.x = 0.5; lvr.userData.lever = true; g.add(lvr);
      return g;
    }
    if (id === 'button') {
      return new THREE.Mesh(new THREE.BoxGeometry(0.3,0.12,0.2),
        new THREE.MeshStandardMaterial({ color:0x777777 }));
    }
    if (def.repeater || def.comparator) {
      const g = new THREE.Group();
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.98,0.16,0.98),
        faceMaterials(def.comparator ? 'comparator' : 'repeater'));
      g.add(slab);
      // facing marker: small nub on front (local +x is front)
      const nub = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.18,0.16),
        new THREE.MeshStandardMaterial({ color: def.comparator?0xcc3030:0x8a0000, emissive:0x000000 }));
      nub.position.set(0.40, 0.02, 0);
      g.add(nub);
      g.userData.nub = nub;
      return g;
    }
    // full block
    return new THREE.Mesh(this.cube, faceMaterials(id));
  }

  place(x, y, z, id, opts={}) {
    if (!BLOCKS[id]) return false;
    const k = key(x,y,z);
    if (this.meshes.has(k)) this._removeMesh(k);
    const def = BLOCKS[id];
    const data = { id, on: id==='lever'?false:undefined };
    if (def.repeater || def.comparator) {
      data.facing = FACE_OK(opts.facing) ? opts.facing : 'E';
      if (def.comparator) data.mode = opts.mode==='subtract' ? 'subtract' : 'compare';
    }
    this.blocks.set(k, data);
    this._markBlockChanged(k);
    const mesh = this._build(id);
    const yo = def.wire ? y-0.47 : (def.repeater||def.comparator) ? y-0.42 : (id==='button'? y-0.44 : y);
    mesh.position.set(x, yo, z);
    if (data.facing) mesh.rotation.y = FACE_ANGLE[data.facing];
    mesh.userData.k = k;
    this.scene.add(mesh);
    this.meshes.set(k, mesh);
    this._spawnParticles(x, y, z, 0xffffff, 4);
    this.refresh();
    return true;
  }

  // right click rotates repeater/comparator facing
  rotateDevice(x, y, z) {
    const b = this.blocks.get(key(x,y,z)); if (!b) return;
    const def = BLOCKS[b.id]; if (!def.repeater && !def.comparator) return;
    const order = ['E','S','W','N'];
    b.facing = order[(order.indexOf(b.facing||'E')+1)%4];
    this._markBlockChanged(key(x,y,z));
    const m = this.meshes.get(key(x,y,z)); if (m) m.rotation.y = FACE_ANGLE[b.facing];
    this.refresh();
  }

  // toggle comparator compare/subtract mode
  toggleMode(x, y, z) {
    const b = this.blocks.get(key(x,y,z)); if (!b || !BLOCKS[b.id].comparator) return;
    b.mode = b.mode==='subtract' ? 'compare' : 'subtract';
    this._markBlockChanged(key(x,y,z));
    this.refresh();
  }

  remove(x, y, z) {
    const k = key(x,y,z);
    const b = this.blocks.get(k); if (!b) return false;
    this._spawnParticles(x, y, z, BLOCKS[b.id].color, 12);
    this.blocks.delete(k); this._markBlockChanged(k); this._removeMesh(k); this.refresh();
    return true;
  }

  toggle(x, y, z) {
    const b = this.blocks.get(key(x,y,z)); if (!b) return;
    if (b.id==='lever') b.on = !b.on;
    if (b.id==='button'){ b.on=true; setTimeout(()=>{b.on=false; this.refresh();},1000); }
    this.refresh();
  }

  setPoweredLamps(keys) {
    this.displayLampKeys = new Set(keys);
    this.refresh();
  }

  _removeMesh(k) {
    const m = this.meshes.get(k);
    if (m){ this.scene.remove(m); this.meshes.delete(k); }
  }

  clear(){ for (const k of [...this.blocks.keys()]){ this.blocks.delete(k); this._markBlockChanged(k); this._removeMesh(k);} this.refresh(); }

  _spawnParticles(x, y, z, color, n) {
    const geo = new THREE.BoxGeometry(0.12,0.12,0.12);
    const mat = new THREE.MeshStandardMaterial({ color });
    for (let i=0;i<n;i++){
      const p = new THREE.Mesh(geo, mat);
      p.position.set(x+(Math.random()-0.5), y+(Math.random()-0.5), z+(Math.random()-0.5));
      p.userData.v = new THREE.Vector3((Math.random()-0.5)*3, Math.random()*3+1, (Math.random()-0.5)*3);
      p.userData.life = 0.6;
      this.scene.add(p); this.particles.push(p);
    }
  }

  _dustShape(x, y, z) {
    let s = '';
    for (const [d,dx,dz] of DIRS) {
      const nb = this.blocks.get(key(x+dx,y,z+dz)) || this.blocks.get(key(x+dx,y-1,z+dz)) || this.blocks.get(key(x+dx,y+1,z+dz));
      if (nb){ const def=BLOCKS[nb.id]; if (def.wire||def.source||def.repeater||def.comparator||def.lamp) s+=d; }
    }
    return s || 'NSEW';
  }

  refresh() {
    this.power = simulate(this);
    for (const k of this.displayLampKeys) {
      if (this.blocks.get(k)?.id === "lamp") this.power.set(k, 15);
    }
    for (const [k, mesh] of this.meshes) {
      const b = this.blocks.get(k); const def = BLOCKS[b.id];
      const p = this.power.get(k) ?? 0;
      if (def.wire) {
        const [x,y,z] = k.split(',').map(Number);
        mesh.material = dustMaterial(this._dustShape(x,y,z));
        mesh.material.emissive.setRGB(Math.min(1,0.15+p/15*0.85), 0, 0);
      } else if (def.lamp) {
        mesh.material = faceMaterials('lamp', p>0);   // glow built in, no extra emissive tweak needed
      } else if (def.torch) {
        const tip = mesh.children.find(c=>c.userData.tip);
        if (tip){ tip.material.emissive.setHex(p>0?0x661414:0x110000);
                  tip.material.color.setHex(p>0?0xff3b3b:0x661414); }
      } else if (def.repeater || def.comparator) {
        const nub = mesh.userData.nub;
        if (nub){ nub.material.emissive.setHex(p>0?0x661010:0x000000);
                  // comparator subtract mode orange, compare mode red
                  if (def.comparator) nub.material.color.setHex(b.mode==='subtract'?0xff9030:0xcc3030); }
      } else if (def.source && mesh.material) {
        if (mesh.material.emissive) mesh.material.emissive.setHex(p>0?0x330000:0x000000);
      }
    }
  }

  pickCenter() {
    this.raycaster.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.raycaster.intersectObjects([...this.meshes.values(), this.ground], true);
    if (!hits.length || hits[0].distance > 8) return null;
    let h = hits[0], obj = h.object;
    while (obj && obj.userData.k===undefined && obj!==this.ground) obj = obj.parent;
    if (obj === this.ground) {
      const px=Math.round(h.point.x), pz=Math.round(h.point.z);
      return { placeAt:[px,0,pz], hit:null };
    }
    const [x,y,z] = obj.userData.k.split(',').map(Number);
    const n = h.face ? h.face.normal.clone().applyQuaternion(h.object.getWorldQuaternion(new THREE.Quaternion())) : {x:0,y:1,z:0};
    return { placeAt:[Math.round(x+n.x),Math.round(y+n.y),Math.round(z+n.z)], hit:[x,y,z], block:[x,y,z] };
  }

  _update(dt) {
    if (typeof this.onFrame === "function") this.onFrame();
    // particles
    for (let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i]; p.userData.life-=dt;
      if (p.userData.life<=0){ this.scene.remove(p); this.particles.splice(i,1); continue; }
      p.userData.v.y -= 9*dt; p.position.addScaledVector(p.userData.v, dt);
    }
    this.clouds.position.x += dt*0.4; if (this.clouds.position.x>40) this.clouds.position.x=-40;
    // crosshair highlight
    const pick = this.locked() ? this.pickCenter() : null;
    if (pick && pick.block){ this.highlight.visible=true; this.highlight.position.set(...pick.block); }
    else this.highlight.visible=false;
    // movement
    if (this.locked()){
      const sp=6;
      const f=(this.keys.KeyW?1:0)-(this.keys.KeyS?1:0);
      const r=(this.keys.KeyD?1:0)-(this.keys.KeyA?1:0);
      const u=(this.keys.Space?1:0)-(this.keys.ShiftLeft?1:0);
      if (f) this.controls.moveForward(f*sp*dt);
      if (r) this.controls.moveRight(r*sp*dt);
      const o=this.controls.getObject(); o.position.y += u*sp*dt;
      if (o.position.y<1.6) o.position.y=1.6;
      const [yaw, pitch] = lookDeltaFromKeys(this.keys, dt);
      if (yaw || pitch) applyLookDelta(this.camera, yaw, pitch);
    }
  }

  _loop() {
    const tick = () => { this._update(this.clock.getDelta());
      this.renderer.render(this.scene, this.camera); requestAnimationFrame(tick); };
    tick();
  }
}
