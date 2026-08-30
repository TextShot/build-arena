// main.js — First person Play Space + Inventory placement + WebMCP
import { World } from "./world.js";
import { BLOCKS, HOTBAR_IDS } from "./blocks.js";
import { registerPlaySpaceTools } from "./ai.js";
import { iconCanvas } from "./textures.js";
import { readAndClearHandoff, readInventory } from "./inventory.js";
import { isPlacing, startPlacement } from "./placement.js";

const SPACE_LOAD_START_PERCENT = 13;
const SPACE_LOAD_MID_PERCENT = 66;
const SPACE_LOAD_DONE_PERCENT = 100;
const SPACE_LOAD_MID_AT_MS = 500;
const SPACE_LOAD_MIN_MS = 600;
const SPACE_LOAD_FALLBACK_MS = 4000;

function spaceLoadPercent(elapsedMs, spaceReady) {
  if (elapsedMs >= SPACE_LOAD_FALLBACK_MS) return SPACE_LOAD_DONE_PERCENT;
  if (elapsedMs < SPACE_LOAD_MID_AT_MS) return SPACE_LOAD_START_PERCENT;
  if (spaceReady && elapsedMs >= SPACE_LOAD_MIN_MS) return SPACE_LOAD_DONE_PERCENT;
  return SPACE_LOAD_MID_PERCENT;
}

function spaceLoadShouldDismiss(elapsedMs, spaceReady) {
  return elapsedMs >= SPACE_LOAD_FALLBACK_MS
    || (spaceReady && elapsedMs >= SPACE_LOAD_MIN_MS);
}

function resolvePlatformSize(value) {
  return Number.isInteger(value) && value % 2 === 1 && value >= 7 && value <= 101 ? value : 51;
}

const handoff = readAndClearHandoff();
const platformSize = resolvePlatformSize(handoff?.platformSize);
const world = new World(document.getElementById("game"), platformSize);
window.world = world;
let selected = 0;
let pendingPlacement = handoff?.kind === "place" && Array.isArray(handoff.blocks) && handoff.blocks.length > 0
  ? handoff.blocks
  : null;

const loadEl = document.getElementById("space-load");
const loadBar = loadEl?.querySelector("[role=progressbar]");
const loadFill = loadBar?.querySelector("span");
const loadStarted = performance.now();
const spaceReady = true;

function tickLoad() {
  if (!loadEl || !loadBar || !loadFill) return;
  const elapsed = performance.now() - loadStarted;
  const percent = spaceLoadPercent(elapsed, spaceReady);
  loadFill.style.width = `${percent}%`;
  loadBar.setAttribute("aria-valuenow", String(percent));
  if (spaceLoadShouldDismiss(elapsed, spaceReady)) {
    loadEl.remove();
    return;
  }
  requestAnimationFrame(tickLoad);
}
tickLoad();

const bar = document.getElementById("hotbar");
HOTBAR_IDS.forEach((id, i) => {
  const s = document.createElement("div");
  s.className = "slot";
  const cv = iconCanvas(id);
  s.appendChild(cv);
  s.title = BLOCKS[id].name;
  s.onclick = () => selectSlot(i);
  bar.appendChild(s);
});
const inventorySlot = document.createElement("div");
inventorySlot.className = "slot inventory-slot";
inventorySlot.textContent = "⋯";
inventorySlot.setAttribute("aria-label", "Open inventory");
inventorySlot.title = "Inventory";
inventorySlot.onclick = (event) => {
  event.stopPropagation();
  toggleInventory();
};
bar.appendChild(inventorySlot);

function hotbarSlots() {
  return [...bar.querySelectorAll(".slot:not(.inventory-slot)")];
}

function selectSlot(i) {
  selected = (i + HOTBAR_IDS.length) % HOTBAR_IDS.length;
  hotbarSlots().forEach((c, j) => c.classList.toggle("on", j === selected));
  document.getElementById("held").textContent = BLOCKS[HOTBAR_IDS[selected]].name;
}
selectSlot(0);

addEventListener("keydown", (e) => {
  if (e.code.startsWith("Digit")) {
    const n = +e.code.slice(5);
    if (n >= 1 && n <= HOTBAR_IDS.length) selectSlot(n - 1);
  }
});
addEventListener("wheel", (e) => {
  if (world.locked()) selectSlot(selected + (e.deltaY > 0 ? 1 : -1));
});

const blocker = document.getElementById("blocker");
blocker.addEventListener("click", () => world.lock());
document.getElementById("game").addEventListener("click", () => world.lock());
world.controls.addEventListener("lock", () => {
  blocker.style.display = "none";
  if (pendingPlacement) {
    startPlacement(world, pendingPlacement);
    pendingPlacement = null;
  }
});
world.controls.addEventListener("unlock", () => {
  if (!inventoryOpen()) blocker.style.display = "flex";
});

addEventListener("mousedown", (e) => {
  if (!world.locked() || isPlacing()) return;
  const pick = world.pickCenter();
  if (!pick) return;
  if (e.button === 0) {
    if (pick.hit) world.remove(...pick.hit);
  } else if (e.button === 2) {
    if (pick.hit) {
      const b = world.blocks.get(pick.hit.join(","));
      if (b) {
        if (b.id === "lever" || b.id === "button") { world.toggle(...pick.hit); return; }
        const def = BLOCKS[b.id];
        if (def.repeater || def.comparator) {
          if (e.shiftKey && def.comparator) world.toggleMode(...pick.hit);
          else world.rotateDevice(...pick.hit);
          return;
        }
      }
    }
    world.place(...pick.placeAt, HOTBAR_IDS[selected]);
  }
});
addEventListener("contextmenu", (e) => e.preventDefault());

document.getElementById("to-arena").addEventListener("click", () => {
  location.assign("/");
});

const overlay = document.getElementById("inventory-overlay");

function inventoryOpen() {
  return overlay && !overlay.hidden;
}

function closeInventory() {
  if (!overlay) return;
  overlay.hidden = true;
  if (!world.locked()) blocker.style.display = "flex";
}

function openInventory() {
  world.unlock();
  const list = overlay.querySelector(".inventory-list");
  const empty = overlay.querySelector(".empty-state");
  list.replaceChildren();
  const { entries } = readInventory();
  if (!entries.length) {
    empty.hidden = false;
  } else {
    empty.hidden = true;
    for (const entry of entries) {
      const li = document.createElement("li");
      const img = document.createElement("img");
      img.width = 48;
      img.height = 48;
      img.alt = "";
      img.src = entry.thumbnail || "";
      const name = document.createElement("span");
      name.textContent = entry.name;
      li.append(img, name);
      li.addEventListener("click", () => {
        closeInventory();
        startPlacement(world, entry.blocks);
      });
      list.appendChild(li);
    }
  }
  overlay.hidden = false;
  blocker.style.display = "none";
}

function toggleInventory() {
  if (inventoryOpen()) closeInventory();
  else openInventory();
}

overlay.addEventListener("click", (event) => {
  if (event.target === overlay) closeInventory();
});
overlay.querySelector(".inventory-dialog")?.addEventListener("click", (event) => {
  event.stopPropagation();
});

addEventListener("keydown", (e) => {
  if (e.code === "Escape" && inventoryOpen()) {
    e.preventDefault();
    closeInventory();
  }
});

const toolAbort = new AbortController();
await registerPlaySpaceTools(world, { signal: toolAbort.signal });
