// ai.js — AI behind the chat box. Prefers Claude API; falls back to local rule engine when no key.
// Built-in RULES as system prompt, constraining AI to redstone building only.

export const SYSTEM_PROMPT = `You are a building assistant in "Redstone World" who only builds redstone circuits — nothing else.
Coordinate system: x east+, z south+, y up+. Ground is y=0; components usually go at y=1.
Available block ids: stone, redstone_wire, redstone_torch, redstone_block, lever, button, repeater, comparator, lamp, piston.
Rules:
- Redstone dust (redstone_wire) loses 1 signal per block, max 15, disconnects at 0.
- Signal sources: redstone_torch/redstone_block always 15, lever outputs 15 when on, button pulses 15.
- redstone_torch is an inverter: it turns off when the block below it is powered.
- repeater: has facing; rear input > 0 → front output 15 (boost / one-way).
- comparator: has facing; compare mode passes rear signal if rear ≥ sides, else 0; subtract mode output = rear − side.
- repeater/comparator placement may include "facing":"E"|"W"|"N"|"S" (front direction, default E=+x); comparator may include "mode":"compare"|"subtract".
- lamp lights when signal ≥ 1.
Each message ends with [World State] listing existing blocks and coordinates — this is your "eyes":
- When extending existing structures, use these coordinates; do not overlap existing blocks (unless intentionally overwriting).
- When building in empty space, pick an area with no blocks.
When the player asks you to build, output only one JSON code block:
{"explain":"one-sentence explanation of the circuit","actions":[{"op":"place","block":"lever","x":0,"y":1,"z":0}]}
op may be place or remove. Max 200 actions. Coordinates are integers, range ±32.
If some actions are rejected by the system, errors will be sent back — output only the corrected JSON.
If the player is only asking a question, explain in English; do not output JSON.`;

export async function askClaude(apiKey, model, history) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || 'claude-opus-4-8',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: history,
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content.map(c => c.text || '').join('');
}

// ---------- Local fallback: minimal intent parsing, works offline ----------
export function localBrain(text) {
  const t = text.toLowerCase();
  const reply = (explain, actions) =>
    '(Local mode)\n```json\n' + JSON.stringify({ explain, actions }, null, 2) + '\n```';

  if (/(switch|lever).*(lamp|light)|lamp.*switch|light.*switch/.test(t)) {
    return reply('Lever via redstone dust lights a redstone lamp: the most basic switch-controlled circuit.', [
      { op:'place', block:'lever',         x:0, y:1, z:0 },
      { op:'place', block:'redstone_wire', x:1, y:1, z:0 },
      { op:'place', block:'redstone_wire', x:2, y:1, z:0 },
      { op:'place', block:'lamp',          x:3, y:1, z:0 },
    ]);
  }
  if (/not gate|not|inverter|invert/.test(t)) {
    return reply('NOT gate: torch on stone powered by lever — input on → torch off → output 0.', [
      { op:'place', block:'lever',          x:0, y:1, z:0 },
      { op:'place', block:'redstone_wire',  x:1, y:1, z:0 },
      { op:'place', block:'stone',          x:2, y:1, z:0 },
      { op:'place', block:'redstone_torch', x:2, y:2, z:0 },
      { op:'place', block:'redstone_wire',  x:3, y:2, z:0 },
      { op:'place', block:'lamp',           x:4, y:2, z:0 },
    ]);
  }
  if (/repeater|amplify|boost|extend/.test(t)) {
    return reply('Use a repeater to boost a decayed signal back to 15 for long-distance transmission.', [
      { op:'place', block:'redstone_block', x:0, y:1, z:0 },
      { op:'place', block:'redstone_wire',  x:1, y:1, z:0 },
      { op:'place', block:'repeater',       x:2, y:1, z:0 },
      { op:'place', block:'redstone_wire',  x:3, y:1, z:0 },
      { op:'place', block:'lamp',           x:4, y:1, z:0 },
    ]);
  }
  if (/button|pulse/.test(t)) {
    return reply('Button pulse circuit: press once, lamp stays on briefly then turns off.', [
      { op:'place', block:'button',        x:0, y:1, z:0 },
      { op:'place', block:'redstone_wire', x:1, y:1, z:0 },
      { op:'place', block:'lamp',          x:2, y:1, z:0 },
    ]);
  }
  if (/clear|reset|empty|delete all/.test(t)) {
    return reply('Clear world.', []);  // main.js handles empty actions + keyword
  }
  // default: treat as question, plain text explanation
  return 'I can only build redstone circuits~ Try saying:\n• "Build a switch-controlled lamp"\n• "Build a NOT gate / inverter"\n• "Use a repeater to boost signal"\n• "Build a button pulse circuit"\n(Connect Claude API to understand any natural language request)';
}
