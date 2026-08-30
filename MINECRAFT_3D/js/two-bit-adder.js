const INPUT_ROWS = Object.freeze([
  ["a1", -3],
  ["a0", -1],
  ["b1", 1],
  ["b0", 3],
]);

const OUTPUT_ROWS = Object.freeze([
  ["sum0", -2],
  ["sum1", 0],
  ["carry", 2],
]);

function key({ x, y, z }) {
  return `${x},${y},${z}`;
}

export function calculateTwoBitSum({ a0, a1, b0, b1 }) {
  const total = Number(Boolean(a0))
    + Number(Boolean(a1)) * 2
    + Number(Boolean(b0))
    + Number(Boolean(b1)) * 2;
  return [total & 1, (total >> 1) & 1, (total >> 2) & 1];
}

export function installTwoBitAdder(world, origin = { x: 0, y: 1, z: 0 }) {
  const inputs = Object.fromEntries(INPUT_ROWS.map(([id, z]) => [
    id,
    { x: origin.x - 4, y: origin.y, z: origin.z + z },
  ]));
  const outputs = Object.fromEntries(OUTPUT_ROWS.map(([id, z]) => [
    id,
    { x: origin.x + 4, y: origin.y, z: origin.z + z },
  ]));

  for (const position of [...Object.values(inputs), ...Object.values(outputs)]) {
    world.place(position.x, position.y - 1, position.z, "stone");
  }
  for (const position of Object.values(inputs)) {
    world.place(position.x, position.y, position.z, "lever");
    world.place(position.x + 1, position.y - 1, position.z, "stone");
    world.place(position.x + 1, position.y, position.z, "redstone_wire");
  }
  for (const position of Object.values(outputs)) {
    world.place(position.x, position.y, position.z, "lamp");
  }

  return Object.freeze({ inputs: Object.freeze(inputs), outputs: Object.freeze(outputs) });
}

export function syncTwoBitAdder(world, adder) {
  const values = Object.fromEntries(Object.entries(adder.inputs).map(([id, position]) => [
    id,
    Boolean(world.blocks.get(key(position))?.on),
  ]));
  const [sum0, sum1, carry] = calculateTwoBitSum(values);
  const poweredLampKeys = [sum0, sum1, carry]
    .map((bit, index) => bit ? key(adder.outputs[OUTPUT_ROWS[index][0]]) : null)
    .filter(Boolean);
  world.setPoweredLamps(poweredLampKeys);
  return [sum0, sum1, carry];
}
