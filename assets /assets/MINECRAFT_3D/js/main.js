// main.js — First person + classic chat box + Agent/AI glue
import { World } from './world.js';
import { BLOCKS, BLOCK_IDS } from './blocks.js';
import { runPlan, extractPlan, worldSnapshot } from './agent.js';
import { askClaude, localBrain } from './ai.js';
import { iconCanvas } from './textures.js';

const world = new World(document.getElementById('game'));
window.world = world;   // for debugging/automation
let selected = 0;   // selected hotbar slot

// ---------- Hotbar (bottom, classic style) ----------
const bar = document.getElementById('hotbar');
BLOCK_IDS.forEach((id, i) => {
  const s = document.createElement('div');
  s.className = 'slot';
  const cv = iconCanvas(id);
  s.appendChild(cv);
  s.title = BLOCKS[id].name;
  s.onclick = () => selectSlot(i);
  bar.appendChild(s);
});
function selectSlot(i){ selected = (i + BLOCK_IDS.length) % BLOCK_IDS.length;
  [...bar.children].forEach((c,j)=>c.classList.toggle('on', j===selected));
  document.getElementById('held').textContent = BLOCKS[BLOCK_IDS[selected]].name;
}
selectSlot(0);

// Number keys 1-9 select item; scroll wheel cycles
addEventListener('keydown', e => {
  if (chatOpen) return;
  if (e.code.startsWith('Digit')) { const n=+e.code.slice(5); if(n>=1&&n<=BLOCK_IDS.length) selectSlot(n-1); }
});
addEventListener('wheel', e => { if(!chatOpen && world.locked()) selectSlot(selected + (e.deltaY>0?1:-1)); });

// ---------- First-person interaction ----------
const blocker = document.getElementById('blocker');
// Click overlay or canvas to enter world (overlay sits above canvas, must bind to overlay)
blocker.addEventListener('click', () => { if(!chatOpen) world.lock(); });
document.getElementById('game').addEventListener('click', () => { if(!chatOpen) world.lock(); });
world.controls.addEventListener('lock',   () => blocker.style.display='none');
world.controls.addEventListener('unlock', () => { if(!chatOpen) blocker.style.display='flex'; });

addEventListener('mousedown', e => {
  if (!world.locked() || chatOpen) return;
  const pick = world.pickCenter();
  if (!pick) return;
  if (e.button === 0) {                 // left click: break
    if (pick.hit) world.remove(...pick.hit);
  } else if (e.button === 2) {          // right click: interact / place
    if (pick.hit) {
      const b = world.blocks.get(pick.hit.join(','));
      if (b) {
        if (b.id==='lever'||b.id==='button') { world.toggle(...pick.hit); return; }
        const def = BLOCKS[b.id];
        if (def.repeater || def.comparator) {       // right click rotates facing; Shift+right click toggles comparator mode
          if (e.shiftKey && def.comparator) world.toggleMode(...pick.hit);
          else world.rotateDevice(...pick.hit);
          return;
        }
      }
    }
    world.place(...pick.placeAt, BLOCK_IDS[selected]);
  }
});
addEventListener('contextmenu', e => e.preventDefault());

// ---------- Classic bottom chat box ----------
const chat = document.getElementById('chat');
const log = document.getElementById('chat-log');
const input = document.getElementById('chat-input');
let chatOpen = false;
let history = [];

addEventListener('keydown', e => {
  if (e.code === 'KeyT' && !chatOpen && !inField(e)) { e.preventDefault(); openChat(); }
  else if (e.code === 'Slash' && !chatOpen && !inField(e)) { openChat(); }
  else if (e.code === 'Escape' && chatOpen) closeChat();
  else if (e.code === 'Enter' && chatOpen) { e.preventDefault(); send(); }
});
function inField(e){ return e.target.tagName==='TEXTAREA' || e.target.tagName==='INPUT'; }
function openChat(){ chatOpen=true; world.unlock(); chat.classList.add('open'); blocker.style.display='none'; setTimeout(()=>input.focus(),0); }
function closeChat(){ chatOpen=false; input.value=''; chat.classList.remove('open'); }

function addMsg(who, text){
  const d=document.createElement('div'); d.className=`line ${who}`;
  const tag = who==='user'?'<You>':who==='ai'?'<AI>':'';
  d.innerHTML = `<span class="who">${tag}</span> ` + text.replace(/</g,'&lt;').replace(/\n/g,'<br>');
  log.appendChild(d); log.scrollTop=log.scrollHeight;
  // chat lines briefly highlight then dim (classic style)
}

async function send(){
  const text = input.value.trim();
  if (!text){ closeChat(); return; }
  input.value='';
  addMsg('user', text);
  closeChat();

  const apiKey = document.getElementById('apikey').value.trim();
  const model = document.getElementById('model').value.trim();

  // attach "world snapshot" as the AI's eyes to the user message
  const seen = worldSnapshot(world);
  let reply;
  try {
    if (apiKey){
      history.push({ role:'user', content:`${text}\n\n[World State]\n${seen}` });
      reply = await askClaude(apiKey, model, history);
      history.push({ role:'assistant', content:reply });
    } else {
      reply = localBrain(text);
      if (/clear|reset|empty/.test(text)) world.clear();
    }
  } catch(err){ reply = '⚠️ '+err.message+' (falling back to local mode)\n'+localBrain(text); }
  addMsg('ai', reply);

  await applyWithRetry(reply, apiKey, model, 1);
}

// execute plan; if sandbox rejects and real AI is connected, feed errors back for self-correction (up to retries times)
async function applyWithRetry(reply, apiKey, model, retries){
  const plan = extractPlan(reply);
  if (!plan) return;
  const r = runPlan(world, plan);
  let note = `Applied ${r.applied} action(s)`;
  if (r.errors.length) note += `, ${r.errors.length} rejected`;
  addMsg('sys', '⛏ '+note);

  if (r.errors.length && apiKey && retries > 0){
    addMsg('sys', '↻ Sending errors back to AI for correction…');
    const fix = `${r.errors.length} action(s) were rejected:\n${r.errors.join('\n')}\nPlease output only the corrected JSON plan.`;
    history.push({ role:'user', content: fix });
    try {
      const reply2 = await askClaude(apiKey, model, history);
      history.push({ role:'assistant', content: reply2 });
      addMsg('ai', reply2);
      await applyWithRetry(reply2, apiKey, model, retries-1);
    } catch(err){ addMsg('sys', '⚠️ Correction failed: '+err.message); }
  }
}

addMsg('sys', 'Press T to open chat and talk to AI. Try: build a switch-controlled lamp / build a NOT gate');
addMsg('sys', 'WASD move · Space up · Shift down · Left click break · Right click place · 1-9 select block');
