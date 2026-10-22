import { blankLevel } from "./levels.js";

// A deliberately small, authored scene. No procedural generation or reinforcements.
export function isometricTestLevel() {
  const level = blankLevel();
  level.name = "Clareira do Rio";
  level.description = "Teste visual isométrico · Fogo, Água e Terra";
  for (const [x, y] of [
    [3, 0],
    [3, 1],
    [3, 2],
    [4, 2],
    [4, 3],
    [4, 4],
    [4, 5],
    [3, 5],
    [3, 6],
    [3, 7],
  ])
    level.ground[y][x] = "water";
  for (const [x, y] of [
    [1, 1],
    [6, 1],
    [0, 5],
    [6, 6],
    [7, 3],
  ])
    level.objects[y][x] = "tree";
  for (const [x, y] of [
    [2, 2],
    [5, 4],
  ])
    level.objects[y][x] = "rock";
  level.units = [
    { id: "fire", element: "fire", team: "ally", x: 2, y: 4 },
    { id: "water", element: "water", team: "ally", x: 2, y: 5 },
    { id: "earth", element: "earth", team: "ally", x: 1, y: 5 },
    { id: "enemy-1", kind: "melee", team: "enemy", x: 4, y: 4 },
  ];
  level.rules = { maxRounds: 5, waves: [] };
  return level;
}

export const ISO = Object.freeze({
  width: 512,
  height: 384,
  halfWidth: 28,
  halfHeight: 14,
  originX: 256,
  originY: 78,
  depth: 18,
});
export function projectCell(x, y) {
  return {
    x: ISO.originX + (x - y) * ISO.halfWidth,
    y: ISO.originY + (x + y) * ISO.halfHeight,
  };
}
export function unprojectPoint(px, py) {
  const a = (px - ISO.originX) / ISO.halfWidth,
    b = (py - ISO.originY) / ISO.halfHeight;
  const x = Math.floor((a + b) / 2 + 0.5),
    y = Math.floor((b - a) / 2 + 0.5);
  return x >= 0 && y >= 0 && x < 8 && y < 8 ? { x, y } : null;
}
export function isometricCellBox(x, y) {
  const p = projectCell(x, y);
  return {
    left: ((p.x - ISO.halfWidth) / ISO.width) * 100,
    top: ((p.y - ISO.halfHeight) / ISO.height) * 100,
    width: ((ISO.halfWidth * 2) / ISO.width) * 100,
    height: ((ISO.halfHeight * 2) / ISO.height) * 100,
  };
}
