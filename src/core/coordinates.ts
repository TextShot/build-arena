/** A position in the arena. X/Z are horizontal; Y is height. */
export type Coordinate = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

/** The stable key used by sparse world storage. */
export type CoordinateKey = `${number},${number},${number}`;

function assertIntegerCoordinate(coordinate: Coordinate): void {
  if (![coordinate.x, coordinate.y, coordinate.z].every(Number.isSafeInteger)) {
    throw new TypeError("Coordinates must contain only safe integers");
  }
}

export function coordinateKey(coordinate: Coordinate): CoordinateKey {
  assertIntegerCoordinate(coordinate);
  return `${coordinate.x},${coordinate.y},${coordinate.z}`;
}

export function coordinateFromKey(key: string): Coordinate {
  const parts = key.split(",");
  if (parts.length !== 3 || !parts.every((part) => /^(0|-?[1-9]\d*)$/.test(part))) {
    throw new Error(`Invalid coordinate key: ${key}`);
  }

  const [x, y, z] = parts.map(Number);
  if (![x, y, z].every(Number.isSafeInteger)) {
    throw new Error(`Invalid coordinate key: ${key}`);
  }

  const coordinate = Object.freeze({ x, y, z });
  assertIntegerCoordinate(coordinate);
  return coordinate;
}
