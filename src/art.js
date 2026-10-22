import { ELEMENTS, SIZE, key, STRUCTURES } from "./engine.js";
import {
  drawExtraGround,
  drawExtraObject,
  drawEffectTile,
} from "./tile-art.js";

const TILE = 64;
export const ENEMY_STEP_MS = 180;
const DAMAGE_MS = 760;
const COLLISION_MS = 340;

// Interpolate one orthogonal segment at a time, including corners of the BFS path.
export function positionOnPath(path, progress) {
  const step = Math.max(0, Math.min(path.length - 1, progress));
  const index = Math.floor(step),
    from = path[index],
    to = path[index + 1] || from;
  const fraction = step - index;
  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
  };
}
const rect = (ctx, x, y, w, h, color) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
};
const rand = (seed) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

export function drawUnit(ctx, unit, x, y, scale = 1) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(scale, scale);
  if (unit.team === "enemy") {
    if (unit.kind === "ranged") {
      // The marksman wears a pointed hood and flared cloak and carries a crossbow.
      rect(ctx, -17, 12, 35, 5, "#10251d88");
      rect(ctx, -8, 8, 6, 9, "#08090b");
      rect(ctx, 3, 8, 6, 9, "#08090b");
      rect(ctx, -10, -5, 20, 9, "#101114");
      rect(ctx, -12, -1, 24, 8, "#101114");
      rect(ctx, -15, 5, 30, 7, "#101114");
      rect(ctx, -17, 11, 34, 4, "#101114");
      rect(ctx, -13, 3, 4, 10, "#1b1a22");
      rect(ctx, 9, 3, 4, 10, "#1b1a22");
      rect(ctx, -7, 6, 14, 10, "#08090b");
      rect(ctx, -2, 7, 4, 9, "#27232e");
      rect(ctx, -4, -22, 8, 4, "#16151b");
      rect(ctx, -8, -18, 16, 4, "#1d1b24");
      rect(ctx, -11, -14, 22, 13, "#101114");
      rect(ctx, -8, -14, 16, 3, "#27232e");
      rect(ctx, -8, -11, 16, 9, "#030405");
      rect(ctx, -7, -10, 5, 4, "#811529");
      rect(ctx, 2, -10, 5, 4, "#811529");
      rect(ctx, -6, -9, 3, 2, "#ff354f");
      rect(ctx, 3, -9, 3, 2, "#ff354f");
      rect(ctx, -10, -1, 5, 6, "#08090b");
      rect(ctx, 5, -1, 5, 6, "#08090b");
      // Stepped bow limbs, taut string and central bolt distinguish its weapon.
      rect(ctx, -20, 0, 4, 7, "#27242e");
      rect(ctx, 16, 0, 4, 7, "#27242e");
      rect(ctx, -17, -2, 5, 4, "#4e405b");
      rect(ctx, 12, -2, 5, 4, "#4e405b");
      rect(ctx, -13, -3, 26, 3, "#5b426f");
      rect(ctx, -16, 6, 32, 1, "#695277");
      rect(ctx, -3, -3, 6, 14, "#24212a");
      rect(ctx, -1, -7, 2, 15, "#9b85ad");
      rect(ctx, -2, -8, 4, 2, "#9b85ad");
      rect(ctx, -5, 3, 3, 4, "#08090b");
      rect(ctx, 2, 3, 3, 4, "#08090b");
      ctx.restore();
      return;
    }
    // A fully masked black sentinel, with a distinct hood and two red eyes.
    rect(ctx, -13, 11, 27, 5, "#10251d88");
    rect(ctx, -9, 7, 7, 8, "#08090b");
    rect(ctx, 3, 7, 7, 8, "#08090b");
    rect(ctx, -12, -4, 24, 16, "#101114");
    rect(ctx, -15, -2, 5, 12, "#08090b");
    rect(ctx, 10, -2, 5, 12, "#08090b");
    rect(ctx, -10, 5, 21, 9, "#17191d");
    rect(ctx, -5, 8, 11, 7, "#0b0c0e");
    rect(ctx, -8, -17, 16, 4, "#17191d");
    rect(ctx, -12, -13, 24, 13, "#0b0c0e");
    rect(ctx, -9, -14, 18, 4, "#24272c");
    rect(ctx, -10, -10, 20, 11, "#101114");
    rect(ctx, -8, -7, 16, 9, "#030405");
    rect(ctx, -8, -6, 6, 4, "#811529");
    rect(ctx, 2, -6, 6, 4, "#811529");
    rect(ctx, -7, -5, 4, 2, "#ff354f");
    rect(ctx, 3, -5, 4, 2, "#ff354f");
    rect(ctx, -2, -1, 4, 7, "#191b20");
    rect(ctx, -12, 1, 5, 3, "#292c31");
    rect(ctx, 7, 1, 5, 3, "#292c31");
    ctx.restore();
    return;
  }
  const palette = {
    fire: ["#d87547", "#ffc17b", "#9b4d34"],
    water: ["#4f9caf", "#a8e4e5", "#376477"],
    earth: ["#8fa75d", "#d5dc92", "#526b3f"],
    lightning: ["#c4a543", "#fff0a4", "#847036"],
    wind: ["#9995cb", "#e0e1ff", "#605c8d"],
  }[unit.element] || ["#8fa75d", "#d5dc92", "#526b3f"];
  // Original top-view uniforms: dark tunic, split scarf, short boots, overhead hair.
  rect(ctx, -13, 11, 27, 5, "#153c3088");
  rect(ctx, -9, 14, 18, 2, "#153c3070");
  rect(ctx, -8, 8, 6, 6, "#263b36");
  rect(ctx, 3, 8, 6, 6, "#263b36");
  rect(ctx, -9, 10, 5, 4, "#182b2b");
  rect(ctx, 4, 10, 5, 4, "#182b2b");
  rect(ctx, -12, -3, 24, 12, "#23393c");
  rect(ctx, -9, -5, 18, 16, "#324b4b");
  rect(ctx, -13, -2, 5, 8, palette[0]);
  rect(ctx, 8, -2, 5, 8, palette[0]);
  rect(ctx, -13, 5, 4, 5, "#e5b78d");
  rect(ctx, 9, 5, 4, 5, "#e5b78d");
  rect(ctx, -8, 3, 16, 4, palette[0]);
  rect(ctx, -3, 3, 6, 4, palette[1]);
  rect(ctx, 5, 7, 7, 3, palette[0]);
  rect(ctx, 9, 10, 5, 3, palette[2]);
  rect(ctx, -9, -14, 18, 15, "#34372f");
  rect(ctx, -7, -15, 14, 3, "#4b4c36");
  rect(ctx, -11, -10, 22, 8, "#34372f");
  rect(ctx, -6, -5, 12, 7, "#f0c49b");
  rect(ctx, -8, -7, 16, 4, "#d9a77c");
  rect(ctx, -8, -6, 16, 3, palette[0]);
  rect(ctx, -3, -6, 6, 3, palette[1]);
  rect(ctx, -6, -2, 3, 2, "#343b36");
  rect(ctx, 4, -2, 3, 2, "#343b36");
  rect(ctx, -6, -13, 5, 4, "#696744");
  rect(ctx, -2, -15, 7, 4, "#535638");
  rect(ctx, 9, -6, 6, 3, palette[0]);
  rect(ctx, 12, -4, 4, 3, palette[2]);
  if (unit.element === "lightning") {
    rect(ctx, -9, -19, 5, 7, "#c4b47a");
    rect(ctx, -2, -22, 5, 9, "#eee1a0");
    rect(ctx, 5, -18, 5, 7, "#c4b47a");
    rect(ctx, -2, -5, 4, 2, "#fff5b8");
    rect(ctx, -3, -3, 4, 3, "#ecd278");
    rect(ctx, -1, 0, 3, 3, "#fff5b8");
    rect(ctx, -16, 0, 3, 7, "#ecd278");
    rect(ctx, -18, 5, 3, 5, "#fff0a4");
  } else if (unit.element === "wind") {
    rect(ctx, -13, -13, 4, 11, "#b9b4db");
    rect(ctx, 9, -13, 4, 11, "#b9b4db");
    rect(ctx, 11, -1, 9, 3, "#e0e1ff");
    rect(ctx, 17, 2, 7, 3, "#9995cb");
    rect(ctx, 21, 5, 5, 3, "#e0e1ff");
    rect(ctx, -6, -17, 12, 3, "#d9d6f1");
  }
  ctx.restore();
}

function tree(ctx, x, y, rng, damaged = false) {
  if (damaged) {
    rect(ctx, x + 19, y + 45, 28, 7, "#244c35");
    rect(ctx, x + 27, y + 28, 11, 23, "#655a39");
    rect(ctx, x + 30, y + 29, 4, 23, "#b69460");
    rect(ctx, x + 35, y + 30, 9, 5, "#655a39");
    rect(ctx, x + 42, y + 28, 5, 5, "#e8c18b");
    for (const [a, b, c, d] of [
      [19, 10, 18, 8],
      [11, 18, 30, 12],
      [8, 30, 22, 10],
      [15, 39, 14, 6],
    ])
      rect(ctx, x + a, y + b, c, d, "#665c36");
    for (const [a, b, c, d] of [
      [20, 12, 13, 5],
      [13, 21, 23, 7],
      [10, 32, 15, 5],
    ])
      rect(ctx, x + a, y + b, c, d, "#b79549");
    rect(ctx, x + 19, y + 22, 9, 3, "#e2c16d");
    rect(ctx, x + 28, y + 35, 6, 3, "#302d24");
    rect(ctx, x + 31, y + 38, 5, 4, "#302d24");
    rect(ctx, x + 28, y + 42, 5, 5, "#302d24");
    for (const [a, b] of [
      [12, 46],
      [43, 41],
      [48, 49],
      [18, 51],
    ])
      rect(ctx, x + a, y + b, 4, 2, "#d5ae5e");
    return;
  }
  rect(ctx, x + 19, y + 45, 28, 7, "#244c35");
  rect(ctx, x + 27, y + 39, 10, 12, "#655a39");
  rect(ctx, x + 30, y + 42, 4, 10, "#91734a");
  const blocks = [
    [19, 7, 26, 9],
    [10, 14, 42, 11],
    [7, 25, 48, 13],
    [12, 38, 41, 8],
    [20, 44, 26, 4],
  ];
  blocks.forEach(([a, b, c, d]) => rect(ctx, x + a, y + b, c, d, "#244e39"));
  [
    [19, 8, 25, 7],
    [12, 15, 36, 12],
    [9, 27, 43, 9],
    [16, 35, 30, 7],
  ].forEach(([a, b, c, d]) => rect(ctx, x + a, y + b, c, d, "#397044"));
  [
    [23, 10, 15, 5],
    [17, 16, 22, 7],
    [11, 28, 16, 7],
    [28, 25, 19, 9],
    [22, 34, 13, 5],
  ].forEach(([a, b, c, d]) => rect(ctx, x + a, y + b, c, d, "#568a4f"));
  [
    [24, 10, 9, 3],
    [18, 18, 12, 4],
    [13, 28, 8, 3],
    [30, 26, 11, 3],
  ].forEach(([a, b, c, d]) => rect(ctx, x + a, y + b, c, d, "#81a957"));
  for (let i = 0; i < 8; i++)
    rect(
      ctx,
      x + 16 + Math.floor(rng() * 28),
      y + 16 + Math.floor(rng() * 20),
      3,
      2,
      "#9ab964",
    );
}

function rock(ctx, x, y) {
  rect(ctx, x + 12, y + 44, 42, 6, "#31583b");
  [
    [22, 16, 22, 5],
    [15, 21, 35, 8],
    [11, 29, 43, 13],
    [16, 42, 34, 5],
  ].forEach(([a, b, c, d]) => rect(ctx, x + a, y + b, c, d, "#566c62"));
  rect(ctx, x + 20, y + 20, 23, 7, "#a1ac8f");
  rect(ctx, x + 15, y + 27, 28, 8, "#8c9c83");
  rect(ctx, x + 16, y + 35, 26, 7, "#778d77");
  rect(ctx, x + 43, y + 28, 7, 14, "#465e56");
  rect(ctx, x + 25, y + 19, 12, 3, "#c0c5a4");
  rect(ctx, x + 18, y + 28, 8, 3, "#b2b99c");
  rect(ctx, x + 33, y + 28, 3, 9, "#65796a");
  rect(ctx, x + 36, y + 35, 7, 3, "#65796a");
  rect(ctx, x + 13, y + 40, 12, 5, "#60844b");
  rect(ctx, x + 15, y + 39, 7, 2, "#8fa554");
}

function barrier(ctx, x, y) {
  rect(ctx, x + 8, y + 18, 48, 32, "#3b4f34");
  rect(ctx, x + 12, y + 14, 40, 31, "#8e895c");
  rect(ctx, x + 16, y + 10, 32, 7, "#c0b783");
  rect(ctx, x + 15, y + 20, 16, 10, "#b0a06a");
  rect(ctx, x + 34, y + 20, 14, 10, "#a08f5d");
  rect(ctx, x + 20, y + 33, 25, 8, "#b0a06a");
}

function wall(ctx, x, y, neighbors, rng) {
  const { north, east, south, west } = neighbors,
    horizontal = east || west || (!north && !south),
    vertical = north || south,
    left = west ? 0 : 12,
    right = east ? 64 : 52,
    top = north ? 0 : 11,
    bottom = south ? 64 : 53;
  // Every fragment keeps its rubble inside its own tile. Adjoining fragments
  // extend the masonry to the shared edge instead of repeating a broken end.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, TILE, TILE);
  ctx.clip();
  if (horizontal) rect(ctx, x + left, y + 23, right - left, 29, "#304f34");
  if (vertical) rect(ctx, x + 22, y + top, 27, bottom - top, "#304f34");
  if (vertical) {
    rect(ctx, x + 20, y + top, 24, bottom - top, "#4c5148");
    rect(ctx, x + 23, y + top, 17, bottom - top, "#a8a48b");
    rect(ctx, x + 25, y + top, 4, bottom - top, "#c2bfa0");
    rect(ctx, x + 40, y + top, 4, bottom - top, "#696d5c");
    for (let yy = top + 10; yy < bottom; yy += 13) {
      rect(ctx, x + 23, y + yy, 17, 2, "#696d5c");
      rect(ctx, x + 32 + (yy % 2 ? -3 : 2), y + yy - 9, 2, 8, "#878d75");
    }
    if (!north) {
      rect(ctx, x + 20, y + top, 7, 4, "#63864e");
      rect(ctx, x + 35, y + top, 9, 6, "#63864e");
      rect(ctx, x + 27, y + top - 3, 8, 5, "#b8b395");
    }
    if (!south) {
      rect(ctx, x + 20, y + bottom - 5, 8, 5, "#4c5148");
      rect(ctx, x + 36, y + bottom - 7, 8, 7, "#63864e");
    }
  }
  if (horizontal) {
    rect(ctx, x + left, y + 19, right - left, 28, "#4c5148");
    rect(ctx, x + left, y + 21, right - left, 12, "#a8a48b");
    rect(ctx, x + left, y + 23, right - left, 3, "#c2bfa0");
    rect(ctx, x + left, y + 33, right - left, 12, "#7c806b");
    rect(ctx, x + left, y + 34, right - left, 2, "#93977c");
    rect(ctx, x + left, y + 39, right - left, 2, "#545d4d");
    for (let xx = left + 12; xx < right; xx += 17) {
      rect(ctx, x + xx, y + 21, 2, 12, "#6a715d");
      rect(ctx, x + xx - 7, y + 35, 2, 4, "#545d4d");
      rect(ctx, x + xx + 3, y + 41, 2, 4, "#545d4d");
    }
    if (!west) {
      rect(ctx, x + left, y + 19, 7, 7, "#63864e");
      rect(ctx, x + left - 3, y + 29, 7, 9, "#7c806b");
      rect(ctx, x + left, y + 42, 5, 5, "#63864e");
    }
    if (!east) {
      rect(ctx, x + right - 6, y + 19, 6, 9, "#63864e");
      rect(ctx, x + right - 2, y + 32, 5, 7, "#7c806b");
      rect(ctx, x + right - 7, y + 41, 7, 6, "#63864e");
    }
  }
  // Missing capstones, hairline cracks and moss establish age even at full HP.
  const chipX = 24 + Math.floor(rng() * 13),
    chipY = horizontal ? 20 : 19 + Math.floor(rng() * 13);
  rect(ctx, x + chipX, y + chipY, 6, 3, "#626c54");
  rect(ctx, x + chipX + 4, y + chipY + 3, 2, 5, "#626c54");
  rect(ctx, x + chipX + 2, y + chipY + 8, 4, 2, "#626c54");
  if (horizontal) {
    rect(ctx, x + 21, y + 43, 10, 4, "#557346");
    rect(ctx, x + 24, y + 41, 5, 2, "#8b9a59");
  } else {
    rect(ctx, x + 39, y + 35, 6, 11, "#557346");
    rect(ctx, x + 38, y + 38, 3, 5, "#8b9a59");
  }
  for (let i = 0; i < 6; i++) {
    const xx = 7 + Math.floor(rng() * 46),
      yy = horizontal
        ? 49 + Math.floor(rng() * 8)
        : 12 + Math.floor(rng() * 44);
    rect(ctx, x + xx, y + yy + 3, 5, 2, "#45603b");
    rect(ctx, x + xx, y + yy, 4 + (i % 2), 3, i % 2 ? "#969b80" : "#7c806b");
  }
  ctx.restore();
}

export function createTerrainCanvas(
  terrain,
  structures = new Map(),
  omitRocks = new Set(),
  layers = null,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  // A displaced rock covers its destination without replacing the ground below it.
  const groundAt = (x, y) =>
    STRUCTURES[terrain[y]?.[x]] ||
    terrain[y]?.[x] === "bush" ||
    terrain[y]?.[x] === "bridge"
      ? structures.get(key(x, y))?.underlay || layers?.ground[y]?.[x] || "grass"
      : terrain[y]?.[x];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const px = x * TILE,
        py = y * TILE,
        type = terrain[y][x],
        rng = rand(x * 912 + y * 3751 + 1189);
      if (groundAt(x, y) === "water") {
        rect(ctx, px, py, 64, 64, (x + y) % 2 ? "#448e8d" : "#418989");
        for (let i = 0; i < 20; i++) {
          const xx = px + Math.floor(rng() * 52),
            yy = py + Math.floor(rng() * 60);
          rect(
            ctx,
            xx,
            yy,
            5 + Math.floor(rng() * 8),
            2,
            i % 3 ? "#60a7a044" : "#a6d4bb88",
          );
        }
        rect(ctx, px, py, 64, 1, "#235c5755");
        rect(ctx, px, py, 1, 64, "#235c5755");
        for (const [dx, dy] of [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ]) {
          if (groundAt(x + dx, y + dy) === "water") continue;
          if (dy === -1) {
            rect(ctx, px, py, 64, 3, "#a3c195");
            rect(ctx, px, py + 3, 64, 2, "#6eac9b");
          }
          if (dy === 1) {
            rect(ctx, px, py + 61, 64, 3, "#8ab18b");
            rect(ctx, px, py + 59, 64, 2, "#6eac9b");
          }
          if (dx === -1) {
            rect(ctx, px, py, 3, 64, "#a3c195");
            rect(ctx, px + 3, py, 2, 64, "#6eac9b");
          }
          if (dx === 1) {
            rect(ctx, px + 61, py, 3, 64, "#8ab18b");
            rect(ctx, px + 59, py, 2, 64, "#6eac9b");
          }
        }
      } else {
        rect(ctx, px, py, 64, 64, (x + y) % 2 ? "#63864e" : "#698b52");
        for (let i = 0; i < 65; i++) {
          const xx = px + Math.floor(rng() * 61),
            yy = py + Math.floor(rng() * 61);
          rect(
            ctx,
            xx,
            yy,
            2 + Math.floor(rng() * 3),
            2,
            i % 3 ? "#7e9e5d77" : "#456c4566",
          );
          if (i % 12 === 0) {
            rect(ctx, xx + 1, yy - 3, 1, 4, "#9ab56d");
            rect(ctx, xx - 2, yy - 1, 2, 1, "#9ab56d");
          }
        }
        if ((x * 3 + y) % 7 === 0) {
          rect(ctx, px + 47, py + 47, 2, 2, "#e5d791");
          rect(ctx, px + 50, py + 43, 2, 2, "#e2cd8a");
        }
        rect(ctx, px, py, 64, 1, "#31533632");
        rect(ctx, px, py, 1, 64, "#31533632");
      }
      drawExtraGround(ctx, groundAt(x, y), px, py);
      if (layers?.deployment?.[y]?.[x])
        drawEffectTile(ctx, "deployment", px, py);
      if (type === "tree")
        tree(ctx, px, py, rng, structures.get(key(x, y))?.hp === 1);
      if (["rock", "hot-rock"].includes(type) && !omitRocks.has(key(x, y)))
        rock(ctx, px, py);
      if (!omitRocks.has(key(x, y)))
        drawExtraObject(ctx, type, px, py, layers?.directions[y]?.[x]);
      if (type === "wall")
        wall(
          ctx,
          px,
          py,
          {
            north: terrain[y - 1]?.[x] === "wall",
            east: terrain[y]?.[x + 1] === "wall",
            south: terrain[y + 1]?.[x] === "wall",
            west: terrain[y]?.[x - 1] === "wall",
          },
          rng,
        );
      drawEffectTile(
        ctx,
        layers?.effects[y]?.[x],
        px,
        py,
        layers?.directions[y]?.[x],
      );
    }
  return canvas;
}

export class BoardRenderer {
  constructor(canvas, battle) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.battle = battle;
    this.base = createTerrainCanvas(
      battle.terrain,
      battle.structures,
      new Set(),
      battle.levelLayers,
    );
    this.terrainRevision = battle.terrainRevision;
    this.terrainOmissions = "";
    this.hover = null;
    this.cursor = null;
    this.effect = null;
    this.feedback = [];
    this.motions = [];
    this.inputLocked = false;
    this.preview = null;
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    this.running = true;
    this.lastFrame = 0;
    this.frame = (time) => {
      if (!this.running) return;
      if (time - this.lastFrame > 40) {
        this.draw(time);
        this.lastFrame = time;
      }
      this.raf = requestAnimationFrame(this.frame);
    };
    this.raf = requestAnimationFrame(this.frame);
  }
  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
  trigger(effect) {
    if (effect) this.effect = { ...effect, start: performance.now() };
  }
  reset() {
    this.base = createTerrainCanvas(
      this.battle.terrain,
      this.battle.structures,
      new Set(),
      this.battle.levelLayers,
    );
    this.terrainRevision = this.battle.terrainRevision;
    this.terrainOmissions = "";
    this.effect = null;
    this.feedback = [];
    this.motions = [];
    this.preview = null;
  }
  consumeEvents(time = performance.now()) {
    const events = this.battle.visualEvents.splice(0);
    let nextMove = Math.max(time, ...this.motions.map((m) => m.end));
    if (events.some((e) => e.type === "damage") && !this.reducedMotion)
      nextMove += 340;
    const dash = events.find((e) => e.type === "dash");
    const impactTime =
      time + (dash && dash.path.length > 1 && !this.reducedMotion ? 300 : 0);
    for (const event of events) {
      if (event.type === "dash") {
        if (!this.reducedMotion && event.path.length > 1)
          this.motions.push({
            ...event,
            start: time,
            end: impactTime,
            stepMs: 300 / (event.path.length - 1),
          });
        continue;
      }
      if (event.type === "enemy-ready") {
        const start = Math.max(
          time,
          ...this.motions.filter((m) => m.id === event.id).map((m) => m.end),
        );
        this.feedback.push({ ...event, start, duration: 1000 });
        continue;
      }
      if (event.type === "push" && event.defeatedUnit) {
        const hit = this.feedback.find(
          (f) => f.type === "damage" && f.id === event.id && f.defeated,
        );
        if (hit) hit.unit = event.defeatedUnit;
      }
      if (
        ["push", "structure-push"].includes(event.type) &&
        !this.reducedMotion
      ) {
        const start = Math.max(
          impactTime,
          ...this.motions.filter((m) => m.id === event.id).map((m) => m.end),
        );
        this.motions.push({ ...event, start, end: start + ENEMY_STEP_MS });
      } else if (event.type === "enemy-move" && !this.reducedMotion) {
        const end = nextMove + (event.path.length - 1) * ENEMY_STEP_MS;
        this.motions.push({ ...event, start: nextMove, end });
        nextMove = end;
      } else if (
        !["enemy-move", "push", "structure-push"].includes(event.type)
      ) {
        const combined =
          event.type === "damage" &&
          this.feedback.find(
            (f) =>
              f.type === "damage" &&
              f.id === event.id &&
              f.start === impactTime,
          );
        if (combined) {
          combined.amount += event.amount;
          combined.defeated = event.defeated;
          combined.unit = event.unit;
        } else
          this.feedback.push({
            ...event,
            start: impactTime,
            duration: event.type === "damage" ? DAMAGE_MS : COLLISION_MS,
          });
      }
    }
    return Math.max(0, ...this.motions.map((m) => m.end - time));
  }
  positionFor(unit, time) {
    const motion = this.motions.find((m) => m.id === unit.id && time < m.end);
    const position = motion
      ? positionOnPath(
          motion.path,
          (time - motion.start) / (motion.stepMs || ENEMY_STEP_MS),
        )
      : { x: unit.x, y: unit.y };
    let offsetX = 0,
      offsetY = 0;
    if (!this.reducedMotion) {
      const impact = this.feedback.find(
        (f) => f.id === unit.id && ["collision", "impact"].includes(f.type),
      );
      if (impact) {
        const t = Math.max(
          0,
          Math.min(1, (time - impact.start) / impact.duration),
        );
        const bump = Math.sin(t * Math.PI) * 14;
        offsetX = (impact.to.x - impact.from.x) * bump;
        offsetY = (impact.to.y - impact.from.y) * bump;
      } else {
        const hit = this.feedback.find(
          (f) => f.id === unit.id && f.type === "damage",
        );
        if (hit) {
          const t = Math.max(0, Math.min(1, (time - hit.start) / 300));
          offsetX = Math.sin(t * Math.PI * 6) * 3 * (1 - t);
        }
      }
    }
    return {
      x: position.x * TILE + offsetX,
      y: position.y * TILE + offsetY,
      walking: motion?.type === "enemy-move" && time >= motion.start,
    };
  }
  draw(time = 0) {
    const { ctx, battle: b } = this;
    this.consumeEvents(time);
    this.feedback = this.feedback.filter((f) => time - f.start < f.duration);
    this.motions = this.motions.filter((m) => time < m.end);
    const animatedRocks = [...b.structures.values()].filter(
      (s) =>
        ["rock", "hot-rock", "crate"].includes(s.type) &&
        (this.motions.some(
          (m) => m.type === "structure-push" && m.id === s.id,
        ) ||
          (!this.reducedMotion &&
            this.feedback.some(
              (f) => f.type === "collision" && f.id === s.id,
            ))),
    );
    const omissions = new Set(animatedRocks.map((s) => key(s.x, s.y))),
      omissionKey = [...omissions].sort().join(";");
    if (
      this.terrainRevision !== b.terrainRevision ||
      this.terrainOmissions !== omissionKey
    ) {
      this.base = createTerrainCanvas(
        b.terrain,
        b.structures,
        omissions,
        b.levelLayers,
      );
      this.terrainRevision = b.terrainRevision;
      this.terrainOmissions = omissionKey;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 512, 512);
    ctx.drawImage(this.base, 0, 0);
    if (b.phase === "deployment")
      for (const p of b.deploymentCells)
        drawEffectTile(ctx, "deployment", p.x * TILE, p.y * TILE);
    const targetCells = this.inputLocked ? [] : b.targets();
    const waveSelected =
      !this.inputLocked &&
      b.mode === "special" &&
      b.selected?.element === "water" &&
      !b.selected.acted;
    const windCenter =
      !this.inputLocked &&
      b.mode === "special" &&
      b.selected?.element === "wind" &&
      !b.selected.acted
        ? this.cursor || this.hover
        : null;
    const radialArea = windCenter
      ? [
          { x: windCenter.x, y: windCenter.y - 1 },
          { x: windCenter.x + 1, y: windCenter.y },
          { x: windCenter.x, y: windCenter.y + 1 },
          { x: windCenter.x - 1, y: windCenter.y },
        ].filter((p) => p.x >= 0 && p.y >= 0 && p.x < SIZE && p.y < SIZE)
      : waveSelected
        ? b.waveArea()
        : [];
    if (radialArea.length) {
      for (const p of radialArea) {
        rect(ctx, p.x * TILE + 3, p.y * TILE + 3, 58, 58, "#efb37838");
        ctx.strokeStyle = "#edb78299";
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x * TILE + 3.5, p.y * TILE + 3.5, 57, 57);
      }
    }
    const targetSet = new Set(targetCells.map((p) => key(p.x, p.y)));
    // Movement is green-blue; attack range is warm. Danger remains readable on both.
    for (const p of targetCells) {
      const x = p.x * 64,
        y = p.y * 64;
      rect(
        ctx,
        x + 2,
        y + 2,
        60,
        60,
        b.mode === "move"
          ? "#8fe2c02a"
          : waveSelected
            ? "#7ad4e966"
            : b.selected?.element === "earth" && b.mode === "special"
              ? "#d7db7540"
              : b.selected?.element === "wind" && b.mode === "special"
                ? "#b8b5ed12"
                : "#efb37830",
      );
      ctx.strokeStyle = b.mode === "move" ? "#b1e0ba88" : "#edb78288";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3.5, y + 3.5, 57, 57);
      if (b.mode === "move") {
        rect(ctx, x + 30, y + 30, 4, 4, "#cbe5ae99");
      }
      if (waveSelected) {
        ctx.strokeStyle = "#b9f3f2";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + 32, y + 32, 25, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    for (const enemy of this.motions.length ? [] : b.enemies)
      if (enemy.intent) {
        const path = b.enemyAttackPath(enemy),
          threatened = b.enemyThreatenedCells(enemy);
        for (const cell of threatened) {
          rect(ctx, cell.x * TILE + 2, cell.y * TILE + 2, 60, 60, "#d86e6338");
          ctx.strokeStyle = "#f2987e88";
          ctx.strokeRect(cell.x * TILE + 3, cell.y * TILE + 3, 58, 58);
        }
        const ex = enemy.x * TILE + 32,
          ey = enemy.y * TILE + 32,
          dx = Math.sign(enemy.intent.x - enemy.x),
          dy = Math.sign(enemy.intent.y - enemy.y);
        ctx.fillStyle = enemy.kind === "ranged" ? "#d2b8ff" : "#ffd2a5";
        ctx.beginPath();
        ctx.moveTo(ex + dx * 29, ey + dy * 29);
        ctx.lineTo(ex + dx * 18 - dy * 6, ey + dy * 18 + dx * 6);
        ctx.lineTo(ex + dx * 18 + dy * 6, ey + dy * 18 - dx * 6);
        ctx.closePath();
        ctx.fill();
        const point = threatened.at(-1) || path[0];
        if (!point) continue;
        const { x, y } = point,
          px = x * 64,
          py = y * 64;
        rect(ctx, px + 2, py + 2, 60, 60, "#d86e6355");
        ctx.strokeStyle = "#f2987e";
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 3, py + 3, 58, 58);
        // Corner danger marks and connecting direction.
        ctx.strokeStyle = "#ffd7ab";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + 8, py + 15);
        ctx.lineTo(px + 8, py + 8);
        ctx.lineTo(px + 15, py + 8);
        ctx.moveTo(px + 49, py + 56);
        ctx.lineTo(px + 56, py + 56);
        ctx.lineTo(px + 56, py + 49);
        ctx.stroke();
        ctx.fillStyle = "#ffd2a5";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "right";
        ctx.fillText("!", px + 54, py + 17);
        ctx.strokeStyle = enemy.kind === "ranged" ? "#d2b8ffbb" : "#f5a68a99";
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(px + 32, py + 32);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    for (const structure of b.structures.values()) {
      const position = this.positionFor(structure, time);
      if (animatedRocks.includes(structure)) {
        if (["rock", "hot-rock"].includes(structure.type)) {
          rock(ctx, position.x, position.y);
          if (structure.type === "hot-rock")
            drawExtraObject(ctx, "hot-rock", position.x, position.y);
        } else drawExtraObject(ctx, structure.type, position.x, position.y);
      }
      if (structure.hp === structure.maxHp) continue;
      const x = position.x,
        y = position.y;
      this.health(structure, x + 32, y + 6, "#e8c18b");
      if (structure.type === "tree") {
        rect(ctx, x + 12, y + 53, 40, 11, "#18372e");
        ctx.fillStyle = "#ffe2a0";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${structure.hp}/${structure.maxHp} PV`, x + 32, y + 62);
        continue;
      }
      ctx.strokeStyle = "#f0d3a0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 30, y + 21);
      ctx.lineTo(x + 26, y + 29);
      ctx.lineTo(x + 34, y + 34);
      ctx.lineTo(x + 30, y + 42);
      ctx.stroke();
    }
    if (b.barrier) {
      const { x, y } = this.positionFor(b.barrier, time);
      barrier(ctx, x, y);
      this.health(b.barrier, x + 32, y + 53, "#d9cb8b");
    }
    for (const unit of b.units) {
      const position = this.positionFor(unit, time);
      const x = position.x,
        y = position.y,
        selected = unit.id === b.selectedId;
      const color =
        unit.team === "enemy"
          ? unit.kind === "ranged"
            ? "#c8b3ed"
            : "#ef9f8b"
          : ELEMENTS[unit.element].color;
      if (selected && ["player", "deployment"].includes(b.phase)) {
        ctx.strokeStyle = "#eef2bd";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 6, y + 12, 52, 44);
        rect(ctx, x + 26, y + 54, 12, 3, "#eef2bd");
      }
      ctx.fillStyle = unit.team === "enemy" ? "#4a343fbb" : "#29483bd9";
      ctx.beginPath();
      ctx.ellipse(x + 32, y + 44, 19, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.save();
      if (unit.acted) ctx.globalAlpha = 0.62;
      const hit = this.feedback.find(
        (f) => f.type === "damage" && f.id === unit.id,
      );
      if (
        hit &&
        time >= hit.start &&
        time - hit.start < 110 &&
        !this.reducedMotion
      )
        ctx.filter = "brightness(0) invert(1)";
      const bob = position.walking
        ? Math.sin((time / ENEMY_STEP_MS) * Math.PI * 2) * 1.5
        : 0;
      drawUnit(ctx, unit, x + 32, y + 33 + bob);
      ctx.restore();
      this.health(unit, x + 32, y + 6, color);
      if (unit.acted) {
        rect(ctx, x + 44, y + 44, 9, 9, "#233e32");
        ctx.strokeStyle = "#c3ce99";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 46, y + 48);
        ctx.lineTo(x + 48, y + 50);
        ctx.lineTo(x + 52, y + 46);
        ctx.stroke();
      }
    }
    const hover = this.cursor || this.hover;
    if (hover) {
      const x = hover.x * 64,
        y = hover.y * 64;
      ctx.strokeStyle = targetSet.has(key(hover.x, hover.y))
        ? "#f4f0c9"
        : "#e1e8c5aa";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, 62, 62);
      if (b.mode === "move" && this.hover) {
        const path = targetCells.find(
          (p) => p.x === hover.x && p.y === hover.y,
        )?.path;
        if (path) {
          ctx.fillStyle = "#ecedbd";
          for (const p of path)
            ctx.fillRect(p.x * 64 + 30, p.y * 64 + 30, 4, 4);
        }
      }
    }
    this.drawPreview();
    this.drawEffect(time);
    this.drawFeedback(time);
  }
  health(unit, cx, y, color) {
    const total = unit.maxHp * 9 - 2,
      start = cx - total / 2;
    for (let i = 0; i < unit.maxHp; i++) {
      rect(this.ctx, start + i * 9 - 1, y - 1, 9, 5, "#18372e");
      rect(this.ctx, start + i * 9, y, 7, 3, i < unit.hp ? color : "#43533e");
    }
  }
  drawPreview() {
    const preview = this.preview;
    if (!preview || this.inputLocked) return;
    const ctx = this.ctx,
      cyan = "#8be5ed",
      violet = "#cab1ff",
      amber = "#f3cb86";
    const badge = (p, text, color, bottom = true) => {
      const width = Math.max(18, text.length * 6 + 8),
        x = p.x * TILE + 32 - width / 2,
        y = p.y * TILE + (bottom ? 49 : 12);
      rect(ctx, x, y, width, 13, "#12251fed");
      ctx.fillStyle = color;
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(text, p.x * TILE + 32, y + 10);
    };
    const arrow = (path, color, dashed = false, offset = 0) => {
      if (path.length < 2) return;
      const points = path.map((p) => ({
        x: p.x * TILE + 32,
        y: p.y * TILE + 32 + offset,
      }));
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.setLineDash(dashed ? [5, 4] : []);
      const trace = () => {
        ctx.beginPath();
        points.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
        );
        ctx.stroke();
      };
      ctx.strokeStyle = "#182921dd";
      ctx.lineWidth = 5;
      trace();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      trace();
      ctx.setLineDash([]);
      const end = points.at(-1),
        prev = points.at(-2),
        angle = Math.atan2(end.y - prev.y, end.x - prev.x);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - Math.cos(angle - 0.55) * 10,
        end.y - Math.sin(angle - 0.55) * 10,
      );
      ctx.lineTo(
        end.x - Math.cos(angle + 0.55) * 10,
        end.y - Math.sin(angle + 0.55) * 10,
      );
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    const cross = (p, color) => {
      const x = Math.max(8, Math.min(504, p.x * TILE + 32)),
        y = Math.max(8, Math.min(504, p.y * TILE + 32));
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 7, y - 7);
      ctx.lineTo(x + 7, y + 7);
      ctx.moveTo(x + 7, y - 7);
      ctx.lineTo(x - 7, y + 7);
      ctx.stroke();
    };
    ctx.save();
    if (preview.effect?.type === "fire")
      arrow([preview.effect.from, preview.effect.to], amber);
    if (preview.effect?.type === "lightning") {
      arrow(preview.effect.path, "#fff0a4", false);
      badge(preview.effect.impactFrom, "DASH · −1 PV", amber);
    }
    if (preview.effect?.type === "wind") {
      arrow([preview.effect.from, preview.at], "#dcd8ff");
      ctx.strokeStyle = "#e0e1ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        preview.at.x * TILE + 32,
        preview.at.y * TILE + 32,
        24,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    for (const unit of preview.units) {
      if (unit.damage)
        badge(
          unit.from,
          `−${unit.damage}`,
          unit.team === "ally" ? amber : "#ffd1bd",
        );
      if (unit.defeated)
        cross(
          preview.pushes.find((p) => p.id === unit.id)?.to || unit.from,
          "#ffb09d",
        );
    }
    for (const push of preview.pushes) {
      const unit = preview.units.find((u) => u.id === push.id),
        color = unit.team === "ally" ? amber : cyan;
      ctx.save();
      ctx.globalAlpha = 0.48;
      drawUnit(
        ctx,
        { team: unit.team, element: unit.element, kind: unit.kind },
        push.to.x * TILE + 32,
        push.to.y * TILE + 33,
      );
      ctx.restore();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(push.to.x * TILE + 5, push.to.y * TILE + 10, 54, 45);
      arrow([push.from, push.to], color, false, -6);
      badge(push.to, `1 · ${unit.hpAfter} PV`, color);
      if (!unit.defeated)
        for (const point of unit.attackCells || []) {
          ctx.strokeStyle = "#ffba76";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(point.x * TILE + 7, point.y * TILE + 7, 50, 50);
          ctx.setLineDash([]);
        }
    }
    for (const movement of preview.structureMoves || []) {
      const drawStructure =
        movement.type === "barrier"
          ? barrier
          : ["rock", "hot-rock"].includes(movement.type)
            ? (ctx, x, y) => {
                rock(ctx, x, y);
                if (movement.type === "hot-rock")
                  drawExtraObject(ctx, "hot-rock", x, y);
              }
            : (ctx, x, y) => drawExtraObject(ctx, movement.type, x, y);
      ctx.save();
      ctx.globalAlpha = 0.48;
      drawStructure(ctx, movement.to.x * TILE, movement.to.y * TILE);
      ctx.restore();
      ctx.strokeStyle = cyan;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        movement.to.x * TILE + 5,
        movement.to.y * TILE + 9,
        54,
        46,
      );
      arrow([movement.from, movement.to], cyan, false, -6);
      if (movement.hpBefore > movement.hpAfter)
        badge(movement.from, `−${movement.hpBefore - movement.hpAfter}`, amber);
      badge(movement.to, `1 · ${movement.hpAfter} PV`, cyan);
    }
    for (const s of preview.structures) {
      if (s.moved) continue;
      const x = s.x * TILE,
        y = s.y * TILE;
      if (s.created) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        if (s.type === "wall")
          wall(
            ctx,
            x,
            y,
            {
              north: false,
              east: false,
              south: false,
              west: false,
            },
            rand(s.x * 912 + s.y * 3751 + 1189),
          );
        else if (s.type === "rock") rock(ctx, x, y);
        else if (s.type === "barrier") barrier(ctx, x, y);
        else drawExtraObject(ctx, s.type, x, y);
        ctx.restore();
      }
      ctx.strokeStyle = amber;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(x + 7, y + 9, 50, 46);
      ctx.setLineDash([]);
      if (s.destroyed) cross(s, "#ffc5a1");
      badge(s, `${s.hpBefore}→${s.hpAfter} PV`, amber);
    }
    for (const impact of preview.collisions) cross(impact.to, amber);
    for (const blocked of preview.blocked.filter(
      (b) => !preview.collisions.some((c) => c.id === b.id),
    ))
      cross(blocked.to, "#eac18c");
    for (const enemy of preview.nextEnemies) {
      if (enemy.status !== "moves") continue;
      arrow(enemy.path, violet, true, 9);
      const x = enemy.to.x * TILE,
        y = enemy.to.y * TILE;
      ctx.strokeStyle = violet;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x + 9, y + 13, 46, 42);
      ctx.setLineDash([]);
      badge(enemy.to, "2", violet, false);
    }
    ctx.restore();
  }
  drawEffect(time) {
    const e = this.effect;
    if (!e) return;
    const elapsed = time - e.start,
      t = elapsed / 650;
    if (t > 1) {
      this.effect = null;
      return;
    }
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    const color = {
      fire: "#ffc276",
      water: "#b0e7ed",
      earth: "#e8db9a",
      lightning: "#fff0a4",
      wind: "#e0e1ff",
      punch: "#fff1cb",
      enemy: "#ffa58d",
      move: "#d5edb7",
    }[e.type];
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    if (e.type === "fire") {
      const x = (e.from.x + (e.to.x - e.from.x) * Math.min(t * 2, 1)) * 64 + 32,
        y = (e.from.y + (e.to.y - e.from.y) * Math.min(t * 2, 1)) * 64 + 32;
      rect(ctx, x - 6, y - 6, 12, 12, "#f6a953");
      rect(ctx, x - 3, y - 3, 6, 6, "#fff0b4");
    } else if (e.type === "lightning") {
      ctx.beginPath();
      ctx.moveTo(e.from.x * TILE + 32, e.from.y * TILE + 32);
      const dx = e.to.x - e.from.x,
        dy = e.to.y - e.from.y;
      for (let i = 1; i <= 8; i++) {
        const jitter = i === 8 ? 0 : i % 2 ? 7 : -7;
        ctx.lineTo(
          (e.from.x + (dx * i) / 8) * TILE + 32 + (dy ? jitter : 0),
          (e.from.y + (dy * i) / 8) * TILE + 32 + (dx ? jitter : 0),
        );
      }
      ctx.stroke();
    } else if (e.type === "wind") {
      const cx = e.to.x * TILE + 32,
        cy = e.to.y * TILE + 32;
      const progress = Math.min(t * 2, 1);
      ctx.beginPath();
      ctx.arc(cx, cy, 12 + progress * 58, t * 7, t * 7 + Math.PI * 1.6);
      ctx.stroke();
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * 20, cy + dy * 20);
        ctx.lineTo(
          cx + dx * (28 + progress * 52),
          cy + dy * (28 + progress * 52),
        );
        ctx.stroke();
      }
    } else if (e.type === "water") {
      const radius = 12 + t * 78;
      ctx.beginPath();
      ctx.arc(e.from.x * 64 + 32, e.from.y * 64 + 32, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (e.type === "enemy") {
      for (const strike of e.strikes) {
        if (strike.cancelled) continue;
        if (strike.kind === "ranged") {
          const end = strike.hit || strike.to,
            progress = Math.min(t * 2, 1);
          const x =
            (strike.from.x + (end.x - strike.from.x) * progress) * TILE + 32;
          const y =
            (strike.from.y + (end.y - strike.from.y) * progress) * TILE + 32;
          const angle = Math.atan2(
            end.y - strike.from.y,
            end.x - strike.from.x,
          );
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          rect(ctx, -11, -1, 19, 3, "#ddd0f5");
          ctx.fillStyle = "#c4a0ff";
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(2, -5);
          ctx.lineTo(2, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          continue;
        }
        const x = strike.to.x * 64 + 32,
          y = strike.to.y * 64 + 32;
        ctx.beginPath();
        ctx.moveTo(x - 13, y - 13);
        ctx.lineTo(x + 13, y + 13);
        ctx.moveTo(x + 13, y - 13);
        ctx.lineTo(x - 13, y + 13);
        ctx.stroke();
      }
    } else if (e.to) {
      const cx = e.to.x * 64 + 32,
        cy = e.to.y * 64 + 32;
      ctx.strokeRect(
        cx - 12 - t * 10,
        cy - 12 - t * 10,
        24 + t * 20,
        24 + t * 20,
      );
    }
    ctx.restore();
  }
  drawFeedback(time) {
    const ctx = this.ctx;
    for (const event of this.feedback) {
      if (time < event.start) continue;
      const t = Math.max(0, Math.min(1, (time - event.start) / event.duration));
      ctx.save();
      ctx.globalAlpha = 1 - t;
      if (event.type === "enemy-ready") {
        const x = event.at.x * TILE,
          y = event.at.y * TILE;
        rect(ctx, x + 6, y + 52, 52, 11, "#211e2bef");
        ctx.fillStyle = event.kind === "ranged" ? "#e2ceff" : "#ffe1aa";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.fillText("ARMADO", x + 32, y + 60);
      } else if (event.type === "damage") {
        const position =
          event.defeated && event.unit
            ? this.positionFor(event.unit, time)
            : { x: event.at.x * TILE, y: event.at.y * TILE };
        const x = position.x,
          y = position.y;
        if (event.defeated && event.unit) {
          if (t < 0.15 && !this.reducedMotion)
            ctx.filter = "brightness(0) invert(1)";
          drawUnit(ctx, event.unit, x + 32, y + 33);
          ctx.filter = "none";
        }
        ctx.strokeStyle = event.unit ? "#ff9b8d" : "#f3d597";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          x + 12 - t * 7,
          y + 13 - t * 7,
          40 + t * 14,
          39 + t * 14,
        );
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#1b2020";
        ctx.strokeText(`−${event.amount}`, x + 32, y + 19 - t * 15);
        ctx.fillStyle = event.unit ? "#ffe3d6" : "#fff0be";
        ctx.fillText(`−${event.amount}`, x + 32, y + 19 - t * 15);
      } else if (["collision", "impact"].includes(event.type)) {
        const x = ((event.from.x + event.to.x) * TILE) / 2 + 32;
        const y = ((event.from.y + event.to.y) * TILE) / 2 + 32;
        ctx.strokeStyle = "#ffd993";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 4 + t * 14, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4,
            spread = 5 + t * 24;
          rect(
            ctx,
            x + Math.cos(angle) * spread - 2,
            y + Math.sin(angle) * spread - 2,
            3,
            3,
            i % 2 ? "#ffc26d" : "#fff0be",
          );
        }
      }
      ctx.restore();
    }
  }
}
