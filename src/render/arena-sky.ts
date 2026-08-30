import {
  CanvasTexture,
  EquirectangularReflectionMapping,
  SRGBColorSpace,
} from "three";

/** Minecraft Overworld daytime zenith (`#78A7FF`). */
const SKY_ZENITH = "#3d8cdb";
const SKY_MID = "#78a7ff";
const SKY_HAZE = "#c5dff8";
const HORIZON = "#dcecc8";
const DISTANT_GRASS = "#7eaf5a";
const NADIR = "#4a6b32";

export function createArenaSkyTexture(): CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is required to paint the arena sky.");

  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, SKY_ZENITH);
  gradient.addColorStop(0.38, SKY_MID);
  gradient.addColorStop(0.47, SKY_HAZE);
  gradient.addColorStop(0.5, HORIZON);
  gradient.addColorStop(0.55, DISTANT_GRASS);
  gradient.addColorStop(1, NADIR);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  paintSun(context, width, height);
  paintClouds(context, width, height);

  const texture = new CanvasTexture(canvas);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function paintSun(context: CanvasRenderingContext2D, width: number, height: number): void {
  const x = width * 0.68;
  const y = height * 0.22;
  const glow = context.createRadialGradient(x, y, 8, x, y, 90);
  glow.addColorStop(0, "rgba(255, 250, 210, 0.95)");
  glow.addColorStop(0.18, "rgba(255, 236, 150, 0.55)");
  glow.addColorStop(1, "rgba(255, 236, 150, 0)");
  context.fillStyle = glow;
  context.fillRect(x - 90, y - 90, 180, 180);
}

function paintClouds(context: CanvasRenderingContext2D, width: number, height: number): void {
  const random = mulberry32(0x5c1e);
  const bandTop = height * 0.1;
  const bandBottom = height * 0.4;
  context.save();
  context.globalCompositeOperation = "source-over";

  for (let cluster = 0; cluster < 28; cluster += 1) {
    const originX = random() * width;
    const originY = bandTop + random() * (bandBottom - bandTop);
    const puffs = 4 + Math.floor(random() * 5);
    const alpha = 0.22 + random() * 0.28;
    context.fillStyle = `rgba(255, 255, 255, ${alpha})`;

    for (let puff = 0; puff < puffs; puff += 1) {
      const px = originX + (random() - 0.5) * 220;
      const py = originY + (random() - 0.5) * 36;
      const rx = 50 + random() * 90;
      const ry = 14 + random() * 18;
      fillWrappedEllipse(context, px, py, rx, ry, width);
    }
  }

  context.restore();
}

function fillWrappedEllipse(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  width: number,
): void {
  ellipse(context, x, y, radiusX, radiusY);
  if (x - radiusX < 0) ellipse(context, x + width, y, radiusX, radiusY);
  if (x + radiusX > width) ellipse(context, x - width, y, radiusX, radiusY);
}

function ellipse(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
): void {
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.fill();
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
