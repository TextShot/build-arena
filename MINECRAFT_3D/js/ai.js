// ai.js — Play Space WebMCP tools wrapping the Sandbox (agent.js runPlan).
import { BLOCK_IDS } from "./blocks.js";
import { runPlan, worldSnapshot } from "./agent.js";
import { readInventory } from "./inventory.js";
import { placeBlocksAtOrigin } from "./placement.js";

export const WORLD_RULES = `You are a building assistant in "Redstone World" who only builds redstone circuits — nothing else.
Coordinate system: x east+, z south+, y up+. Ground grass is y=-1; first empty cell on grass is y=0.
Coordinate bound is the current world.radius (not ±32). Available block ids: ${BLOCK_IDS.join(", ")}.
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
{"explain":"one-sentence explanation of the circuit","actions":[{"op":"place","block":"lever","x":0,"y":0,"z":0}]}
op may be place or remove. Max 200 actions. Coordinates are integers; x/z within ±world.radius, y 0..31.
If some actions are rejected by the system, errors will be sent back — output only the corrected JSON.
If the player is only asking a question, explain in English; do not output JSON.`;

const EMPTY_OBJECT = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

const COORD = { type: "integer" };

function playSpaceSchemas() {
  return {
    get_world_state: {
      type: "object",
      description: "Read the current Play Space blocks, platform size, and radius.",
      properties: {},
      additionalProperties: false,
    },
    run_build_plan: {
      type: "object",
      description: `${WORLD_RULES} Passes actions through the Sandbox (runPlan). Returns { ok, applied, errors }.`,
      properties: {
        explain: { type: "string", description: "One-sentence explanation of the circuit." },
        actions: {
          type: "array",
          description: "Sandbox actions to apply.",
          maxItems: 200,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["op", "x", "y", "z"],
            properties: {
              op: { type: "string", enum: ["place", "remove"], description: "place a block or remove one." },
              block: { type: "string", enum: BLOCK_IDS, description: "Catalogue id; required for place." },
              x: { ...COORD, description: "World X (east+)." },
              y: { ...COORD, description: "World Y (up+). First cell on grass is 0." },
              z: { ...COORD, description: "World Z (south+)." },
              facing: { type: "string", enum: ["N", "E", "S", "W"], description: "Repeater/comparator front." },
              mode: { type: "string", enum: ["compare", "subtract"], description: "Comparator mode." },
            },
          },
        },
      },
      required: ["actions"],
      additionalProperties: false,
    },
    clear_world: {
      type: "object",
      description: "Remove every placed block from the Play Space. Terrain stays.",
      properties: {},
      additionalProperties: false,
    },
    place_blueprint_from_inventory: {
      type: "object",
      description: "Place a saved Inventory build at origin using world.place (not runPlan).",
      properties: {
        id: { type: "string", description: "Inventory entry id." },
        origin: {
          type: "object",
          additionalProperties: false,
          required: ["x", "y", "z"],
          properties: {
            x: { ...COORD, description: "World X of the min-corner." },
            y: { ...COORD, description: "Ignored for Y; transplant uses arenaY - 1." },
            z: { ...COORD, description: "World Z of the min-corner." },
          },
        },
      },
      required: ["id", "origin"],
      additionalProperties: false,
    },
  };
}

function describeTool(name, schemas) {
  return schemas[name].description ?? name;
}

export async function registerPlaySpaceTools(world, { signal, modelContext } = {}) {
  const ctx = modelContext ??
    (typeof document !== "undefined" ? document.modelContext : undefined);
  if (!ctx || typeof ctx.registerTool !== "function" || signal?.aborted) {
    return false;
  }

  const schemas = playSpaceSchemas();
  const names = ["get_world_state", "run_build_plan", "clear_world", "place_blueprint_from_inventory"];
  const handlers = {
    get_world_state: () => ({
      snapshot: worldSnapshot(world),
      platformSize: world.platformSize,
      radius: world.radius,
    }),
    run_build_plan: (args) => runPlan(world, args ?? {}),
    clear_world: () => {
      world.clear();
      return { ok: true };
    },
    place_blueprint_from_inventory: (args) => {
      const id = args?.id;
      const origin = args?.origin;
      const entry = readInventory().entries.find((item) => item.id === id);
      if (!entry) return { ok: false, error: `No inventory entry "${id}"` };
      if (!origin || !Number.isInteger(origin.x) || !Number.isInteger(origin.y) || !Number.isInteger(origin.z)) {
        return { ok: false, error: "origin must be integer {x,y,z}" };
      }
      const { applied } = placeBlocksAtOrigin(world, entry.blocks, origin);
      return { ok: true, applied };
    },
  };

  try {
    for (const name of names) {
      await ctx.registerTool(
        {
          name,
          description: describeTool(name, schemas),
          inputSchema: name === "get_world_state" || name === "clear_world" ? EMPTY_OBJECT : schemas[name],
          annotations: { readOnlyHint: name === "get_world_state" },
          execute: (args) => handlers[name](args),
        },
        signal ? { signal } : undefined,
      );
    }
    return true;
  } catch {
    return false;
  }
}
