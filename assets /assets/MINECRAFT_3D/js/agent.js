// agent.js — Agent interface: AI can only operate the world through these restricted commands
// This is the "sandbox": any block/operation not on the whitelist is rejected; AI cannot exceed its scope.
import { BLOCK_IDS } from './blocks.js';

const MAX_ACTIONS = 200;
const BOUND = 32;  // coordinate range limit

// Validate and execute an agent plan. Returns {ok, applied, errors}
export function runPlan(world, plan) {
  const errors = [];
  if (!plan || !Array.isArray(plan.actions)) {
    return { ok: false, applied: 0, errors: ['Plan missing actions array'] };
  }
  if (plan.actions.length > MAX_ACTIONS) {
    return { ok: false, applied: 0, errors: [`Too many actions (>${MAX_ACTIONS})`] };
  }
  let applied = 0;
  for (const [i, a] of plan.actions.entries()) {
    const e = validate(a);
    if (e) { errors.push(`#${i}: ${e}`); continue; }
    if (a.op === 'place') world.place(a.x, a.y, a.z, a.block, { facing: a.facing, mode: a.mode });
    else if (a.op === 'remove') world.remove(a.x, a.y, a.z);
    applied++;
  }
  return { ok: errors.length === 0, applied, errors };
}

function validate(a) {
  if (!a || typeof a !== 'object') return 'Action is not an object';
  if (a.op !== 'place' && a.op !== 'remove') return `Invalid op=${a.op}`;
  for (const c of ['x','y','z']) {
    if (!Number.isInteger(a[c])) return `${c} must be an integer`;
    if (Math.abs(a[c]) > BOUND) return `${c} out of range ±${BOUND}`;
  }
  if (a.op === 'place' && !BLOCK_IDS.includes(a.block)) {
    return `Unknown block "${a.block}" (not on whitelist, rejected)`;
  }
  return null;
}

// World snapshot: compress all blocks into lines of "id x y z [on]", fed to AI as its "eyes"
export function worldSnapshot(world) {
  const lines = [];
  for (const [k, b] of world.blocks) {
    const [x,y,z] = k.split(',');
    lines.push(`${b.id} ${x} ${y} ${z}${b.on?' on':''}`);
  }
  if (!lines.length) return '(World is currently empty)';
  return `World currently has ${lines.length} block(s):\n` + lines.join('\n');
}

// Extract JSON plan from AI text (tolerates ```json code blocks or bare JSON)
export function extractPlan(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); }
  catch { return null; }
}
