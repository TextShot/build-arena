// main.js — First person Play Space + Inventory placement + WebMCP
import { World } from "./world.js";
import { BLOCKS, HOTBAR_IDS, heldHotbarLabel, hotbarSlotForDigit } from "./blocks.js";
import { registerPlaySpaceTools } from "./ai.js";
import { iconCanvas } from "./textures.js";
import { readAndClearHandoff, readInventory } from "./inventory.js";
import { cancelPlacement, isPlacing, placeBlocksAtOrigin, startPlacement } from "./placement.js";
import { LOOK_BY_ARROW } from "./look.js";
import { editActionFromKey, ManualEditor } from "./edit-history.js";
import { fitSignText } from "./sign-text.js";
import { startThemeMusic, toggleThemeMusic } from "./theme-music.js";

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
const manualEditor = new ManualEditor(world);
let selected = 0;
let pendingPlacement = null;
if (handoff?.kind === "place" && Array.isArray(handoff.blocks) && handoff.blocks.length > 0) {
  placeBlocksAtOrigin(world, handoff.blocks, { x: 0, y: 0, z: 0 });
}

const loadEl = document.getElementById("space-load");
const loadBar = loadEl?.querySelector("[role=progressbar]");
const loadFill = loadBar?.querySelector("span");
const playBtn = document.getElementById("space-play");
const loadStarted = performance.now();
const spaceReady = true;

function dismissLoadAndPlay() {
  startThemeMusic();
  loadEl?.remove();
  world.lock();
}

playBtn?.addEventListener("click", dismissLoadAndPlay);

function tickLoad() {
  if (!loadEl || !loadBar || !loadFill) return;
  const elapsed = performance.now() - loadStarted;
  const percent = spaceLoadPercent(elapsed, spaceReady);
  loadFill.style.width = `${percent}%`;
  loadBar.setAttribute("aria-valuenow", String(percent));
  if (spaceLoadShouldDismiss(elapsed, spaceReady)) {
    loadFill.style.width = "100%";
    loadBar.setAttribute("aria-valuenow", "100");
    if (playBtn) playBtn.hidden = false;
    startThemeMusic();
    return;
  }
  requestAnimationFrame(tickLoad);
}
tickLoad();

const bar = document.getElementById("hotbar");
const editingStatus = document.getElementById("editing-status");
const signEditorOverlay = document.getElementById("sign-editor-overlay");
const signEditorForm = document.getElementById("sign-editor-form");
const signEditorText = document.getElementById("sign-editor-text");
let activeSignPosition = null;
let closingSignEditor = false;
let signUnlockPending = false;
let pendingSignClose = null;
let editingStatusTimer = null;
let fallbackNoticeShown = false;

function signEditorOpen() {
  return !signEditorOverlay.hidden;
}

function openSignEditor(position) {
  const block = world.blocks.get(position.join(","));
  if (!block || block.id !== "oak_sign") return;
  activeSignPosition = [...position];
  signEditorText.value = block.text ?? "";
  signEditorOverlay.hidden = false;
  world.setInputSuspended(true);
  signUnlockPending = true;
  world.interaction.addEventListener("unlock", () => {
    signUnlockPending = false;
    queueMicrotask(() => {
      pendingSignClose?.();
      pendingSignClose = null;
    });
  }, { once: true });
  world.unlock();
  signEditorText.focus();
  signEditorText.setSelectionRange(signEditorText.value.length, signEditorText.value.length);
}

function closeSignEditor(save) {
  if (!signEditorOpen() || closingSignEditor) return;
  if (save && activeSignPosition) world.setSignText(...activeSignPosition, signEditorText.value);
  const finish = () => {
    signEditorOverlay.hidden = true;
    activeSignPosition = null;
    closingSignEditor = false;
    world.setInputSuspended(false);
    hidePauseMenu();
    world.lock();
  };
  if (signUnlockPending) {
    closingSignEditor = true;
    pendingSignClose = finish;
    return;
  }
  finish();
}

signEditorText.addEventListener("input", () => {
  const fitted = fitSignText(signEditorText.value);
  if (fitted.text !== signEditorText.value) signEditorText.value = fitted.text;
});
signEditorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  closeSignEditor(true);
});

function updateEditingStatus(message) {
  clearTimeout(editingStatusTimer);
  editingStatus.textContent = message
    ?? `Build: ${manualEditor.isLocked() ? "Locked" : "Unlocked"} (L)`;
}

function flashEditingStatus(message, duration = 1800) {
  updateEditingStatus(message);
  editingStatusTimer = setTimeout(() => updateEditingStatus(), duration);
}

function handleHistoryResult(result) {
  if (result.status === "applied") {
    updateEditingStatus();
  } else if (result.status === "conflict") {
    flashEditingStatus("History reset: world changed outside manual build");
  } else if (result.status === "locked") {
    flashEditingStatus("Build locked — press L to unlock");
  }
}

updateEditingStatus();
HOTBAR_IDS.forEach((id, i) => {
  const s = document.createElement("div");
  s.className = "slot";
  const cv = iconCanvas(id);
  s.appendChild(cv);
  s.title = heldHotbarLabel(id, i);
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
  document.getElementById("held").textContent = heldHotbarLabel(HOTBAR_IDS[selected], selected);
}
selectSlot(0);

addEventListener("keydown", (event) => {
  if (signEditorOpen()) return;
  const action = editActionFromKey(event);
  if (!action) return;
  event.preventDefault();
  if (action === "toggle-lock") {
    const locked = manualEditor.toggleLocked();
    if (locked) cancelPlacement();
    updateEditingStatus();
    return;
  }
  handleHistoryResult(action === "undo" ? manualEditor.undo() : manualEditor.redo());
});

addEventListener("keydown", (event) => {
  if (
    event.code !== "KeyM" || event.repeat ||
    event.metaKey || event.ctrlKey || event.altKey ||
    signEditorOpen()
  ) return;
  event.preventDefault();
  toggleThemeMusic();
});

addEventListener("keydown", (e) => {
  if (signEditorOpen()) return;
  if (e.code === "KeyB" && !inventoryOpen()) {
    e.preventDefault();
    selectSlot(HOTBAR_IDS.indexOf("oak_sign"));
    return;
  }
  const digitMatch = e.code.match(/^(?:Digit|Numpad)(\d)$/);
  if (!digitMatch) return;
  const slot = hotbarSlotForDigit(+digitMatch[1]);
  if (slot != null && slot < HOTBAR_IDS.length) selectSlot(slot);
});
let lastHotbarScrollAt = -Infinity;
addEventListener("wheel", (event) => {
  const menuOpen = signEditorOpen()
    || inventoryOpen()
    || loadEl?.isConnected
    || blocker.classList.contains("is-open");
  const now = performance.now();
  if (menuOpen || event.deltaY === 0 || now - lastHotbarScrollAt < 500) return;
  lastHotbarScrollAt = now;
  selectSlot(selected + Math.sign(event.deltaY));
});

const blocker = document.getElementById("blocker");
let openingInventory = false;

function showPauseMenu() {
  blocker.classList.add("is-open");
}

function hidePauseMenu() {
  blocker.classList.remove("is-open");
}

blocker.addEventListener("click", (event) => {
  if (event.target.closest("button")) return;
  hidePauseMenu();
  world.lock();
});
document.getElementById("game").addEventListener("click", () => world.lock());
world.interaction.addEventListener("lock", () => {
  hidePauseMenu();
  if (world.fallbackAvailable && !fallbackNoticeShown) {
    fallbackNoticeShown = true;
    flashEditingStatus("This browser doesn't support Pointer Lock. Use arrow keys or switch to Chrome.", 6000);
  }
  if (pendingPlacement) {
    if (manualEditor.isLocked()) {
      flashEditingStatus("Build locked — press L before placing Inventory blocks");
    } else {
      startPlacement(world, pendingPlacement, {
        canCommit: () => !manualEditor.isLocked(),
        onBlocked: () => flashEditingStatus("Build locked — press L to place"),
      });
    }
    pendingPlacement = null;
  }
});
world.interaction.addEventListener("unlock", () => {
  if (openingInventory || inventoryOpen() || signEditorOpen()) return;
  showPauseMenu();
});

addEventListener("mousedown", (e) => {
  if (!world.locked() || isPlacing()) return;
  const pick = world.pickCenter();
  if (!pick) return;
  if (e.button === 2) {
    if (!pick.hit) return;
    const result = manualEditor.edit(pick.hit, () => world.remove(...pick.hit));
    if (result.status === "locked") flashEditingStatus("Build locked — press L to unlock");
  } else if (e.button === 0) {
    if (pick.hit) {
      const b = world.blocks.get(pick.hit.join(","));
      if (b) {
        if (b.id === "oak_sign") {
          openSignEditor(pick.hit);
          return;
        }
        if (b.id === "lever" || b.id === "button") {
          world.toggle(...pick.hit);
          return;
        }
        const def = BLOCKS[b.id];
        if (def.repeater || def.comparator) {
          const result = manualEditor.edit(pick.hit, () => {
            if (e.shiftKey && def.comparator) world.toggleMode(...pick.hit);
            else world.rotateDevice(...pick.hit);
          });
          if (result.status === "locked") flashEditingStatus("Build locked — press L to unlock");
          return;
        }
      }
    }
    const selectedId = HOTBAR_IDS[selected];
    const options = selectedId === "oak_sign" ? { facing: world.facingTowardPlayer() } : undefined;
    const result = manualEditor.edit(pick.placeAt, () => world.place(...pick.placeAt, selectedId, options));
    if (result.status === "locked") flashEditingStatus("Build locked — press L to unlock");
    else if (selectedId === "oak_sign") openSignEditor(pick.placeAt);
  }
});
addEventListener("contextmenu", (e) => e.preventDefault());

document.getElementById("to-arena").addEventListener("click", (event) => {
  event.stopPropagation();
  location.assign(import.meta.env.BASE_URL);
});
document.getElementById("switch-mode")?.addEventListener("click", (event) => {
  event.stopPropagation();
  hidePauseMenu();
  world.lock();
});

const overlay = document.getElementById("inventory-overlay");

function inventoryOpen() {
  return overlay && !overlay.hidden;
}

function setLookPadPressed(code, pressed) {
  const direction = LOOK_BY_ARROW[code];
  if (!direction) return;
  document.querySelector(`#look-pad [data-look="${direction}"]`)?.classList.toggle("is-pressed", pressed);
}

addEventListener("keydown", (e) => {
  if (!LOOK_BY_ARROW[e.code]) return;
  if (signEditorOpen()) return;
  if (document.activeElement?.tagName === "TEXTAREA") return;
  if (inventoryOpen()) return;
  setLookPadPressed(e.code, true);
});
addEventListener("keyup", (e) => setLookPadPressed(e.code, false));
addEventListener("blur", () => {
  for (const direction of Object.values(LOOK_BY_ARROW)) {
    document.querySelector(`#look-pad [data-look="${direction}"]`)?.classList.remove("is-pressed");
  }
});

function closeInventory() {
  if (!overlay) return;
  overlay.hidden = true;
}

function openInventory() {
  openingInventory = true;
  world.unlock();
  openingInventory = false;
  hidePauseMenu();
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
        pendingPlacement = entry.blocks;
        hidePauseMenu();
        world.lock();
      });
      list.appendChild(li);
    }
  }
  overlay.hidden = false;
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
  if (signEditorOpen()) {
    if (e.code === "Escape") {
      e.preventDefault();
      closeSignEditor(false);
    }
    return;
  }
  if (e.code === "KeyE") {
    e.preventDefault();
    toggleInventory();
    return;
  }
  if (e.code !== "Escape") return;
  if (inventoryOpen()) {
    e.preventDefault();
    closeInventory();
    showPauseMenu();
    return;
  }
  e.preventDefault();
  if (world.locked()) world.unlock();
  else showPauseMenu();
});

const toolAbort = new AbortController();
await registerPlaySpaceTools(world, {
  signal: toolAbort.signal,
  onRegistrationError: () => flashEditingStatus("Agent tools unavailable. Reload to retry.", 6000),
});
document.documentElement.dataset.appReady = "true";
document.getElementById("startup-recovery")?.setAttribute("hidden", "");
