import test from "node:test";
import assert from "node:assert/strict";
import { Battle, DIRECTIONS, key } from "../src/engine.js";
import { validateLevel } from "../src/levels.js";
import {
  isometricTestLevel,
  projectCell,
  unprojectPoint,
  isometricCellBox,
  ISO,
} from "../src/isometric-scene.js";

test("reduced isometric scene has an authored connected river, three original ninjas, one enemy and no waves", () => {
  const l = isometricTestLevel();
  assert.deepEqual(validateLevel(l).errors, []);
  assert.deepEqual(
    l.units.filter((u) => u.team === "ally").map((u) => u.id),
    ["fire", "water", "earth"],
  );
  assert.equal(l.units.filter((u) => u.team === "enemy").length, 1);
  assert.deepEqual(l.rules.waves, []);
  assert.deepEqual(new Set(l.ground.flat()), new Set(["grass", "water"]));
  assert.deepEqual(new Set(l.objects.flat()), new Set([null, "tree", "rock"]));
  const water = [];
  l.ground.forEach((row, y) =>
    row.forEach((t, x) => {
      if (t === "water") water.push({ x, y });
    }),
  );
  const queue = [water[0]],
    seen = new Set([key(water[0].x, water[0].y)]);
  for (const p of queue)
    for (const [dx, dy] of DIRECTIONS) {
      const x = p.x + dx,
        y = p.y + dy;
      if (l.ground[y]?.[x] === "water" && !seen.has(key(x, y))) {
        seen.add(key(x, y));
        queue.push({ x, y });
      }
    }
  assert.equal(seen.size, water.length);
  assert.ok(water.some((p) => p.y === 0) && water.some((p) => p.y === 7));
  l.ground[0][0] = "water";
  assert.equal(isometricTestLevel().ground[0][0], "grass");
});
test("all 64 projected cell centers round-trip and map corners reject outside clicks", () => {
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const p = projectCell(x, y);
      assert.deepEqual(unprojectPoint(p.x, p.y), { x, y });
      for (const [dx, dy] of [
        [0, -10],
        [18, 0],
        [0, 10],
        [-18, 0],
      ])
        assert.deepEqual(unprojectPoint(p.x + dx, p.y + dy), { x, y });
    }
  for (const p of [
    { x: 0, y: 0 },
    { x: 511, y: 383 },
    projectCell(-1, 0),
    projectCell(0, -1),
    projectCell(8, 7),
  ])
    assert.equal(unprojectPoint(p.x, p.y), null);
});
test("DOM diamond bounds share the renderer geometry at any CSS scale", () => {
  for (const width of [320, 512, 648])
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const r = isometricCellBox(x, y),
          center = projectCell(x, y),
          height = (width * ISO.height) / ISO.width;
        assert.ok(
          Math.abs(
            ((r.left + r.width / 2) / 100) * width -
              (center.x / ISO.width) * width,
          ) < 1e-8,
        );
        assert.ok(
          Math.abs(
            ((r.top + r.height / 2) / 100) * height -
              (center.y / ISO.height) * height,
          ) < 1e-8,
        );
      }
});
test("the fixed scene uses existing movement, lethal impact, structure damage, victory and exact reset", () => {
  const b = new Battle({ level: isometricTestLevel() }),
    before = structuredClone(b.terrain);
  assert.equal(b.totalEnemies, 1);
  assert.equal(b.pendingReinforcements, 0);
  assert.ok(b.move(3, 4));
  const preview = b.previewAction(4, 4, "punch");
  assert.equal(preview.units[0].damage, 2);
  assert.equal(preview.structures[0].hpAfter, 1);
  assert.ok(b.punch(4, 4));
  assert.equal(b.phase, "victory");
  assert.equal(b.kills, 1);
  assert.equal(b.structureAt(5, 4).hp, 1);
  b.reset();
  assert.deepEqual(b.terrain, before);
  assert.equal(b.structureAt(5, 4).hp, 2);
  assert.equal(b.enemies.length, 1);
  assert.equal(b.pendingReinforcements, 0);
  b.beginEnemyTurn();
  b.resolveEnemyTurn();
  assert.equal(b.enemies.length, 1);
  assert.equal(b.round, 2);
});
