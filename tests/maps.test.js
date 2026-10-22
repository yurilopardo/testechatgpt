import test from "node:test";
import assert from "node:assert/strict";
import { generateMap, normalizeSeed, randomSeed } from "../src/maps.js";

const cells = () =>
  Array.from({ length: 64 }, (_, i) => ({ x: i % 8, y: Math.floor(i / 8) }));
const key = ({ x, y }) => `${x},${y}`;
const neighbors = ({ x, y }) =>
  [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ]
    .filter(([a, b]) => a >= 0 && b >= 0 && a < 8 && b < 8)
    .map(([x, y]) => ({ x, y }));
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
function components(points) {
  const remaining = new Set(points.map(key)),
    groups = [];
  for (const point of points) {
    if (!remaining.delete(key(point))) continue;
    const group = [point];
    for (const current of group)
      for (const next of neighbors(current))
        if (remaining.delete(key(next))) group.push(next);
    groups.push(group);
  }
  return groups;
}

test("map seeds have stable human-readable normalization", () => {
  assert.equal(normalizeSeed("  Rio São Jorge!  "), "rio-sao-jorge");
  assert.equal(normalizeSeed(0), "0");
  assert.equal(normalizeSeed(1234), normalizeSeed("1234"));
  assert.equal(normalizeSeed(undefined), "triade");
  assert.equal(normalizeSeed(null), "triade");
  assert.equal(normalizeSeed(Infinity), "triade");
  assert.equal(normalizeSeed("!@#$"), "triade");
  assert.equal(normalizeSeed("a".repeat(50)).length, 32);
  assert.match(randomSeed(), /^[a-z0-9-]{1,32}$/);
  assert.notEqual(randomSeed(), randomSeed());
});

test("the same normalized seed reproduces all terrain and spawn positions", () => {
  for (const seed of ["triade", " Rio São Jorge! ", 0, 19, "a".repeat(80)]) {
    assert.deepEqual(generateMap(seed), generateMap(seed));
    assert.deepEqual(generateMap(seed), generateMap(normalizeSeed(seed)));
  }
});

test("separate generated maps never share terrain rows or spawn objects", () => {
  const first = generateMap("independente"),
    second = generateMap("independente");
  for (let y = 0; y < 8; y++)
    assert.notEqual(first.terrain[y], second.terrain[y]);
  for (const id in first.spawns)
    assert.notEqual(first.spawns[id], second.spawns[id]);
  first.terrain[0][0] = "mutated";
  first.spawns.fire.x = 99;
  assert.deepEqual(second, generateMap("independente"));
});

test("400 procedural maps preserve coherent terrain, connected routes and legal spawns", () => {
  const signatures = new Set(),
    kinds = new Set(),
    formations = new Set();
  for (let seed = 0; seed < 400; seed++) {
    const map = generateMap(`amostra-${seed}`),
      { terrain, spawns, waterKind } = map;
    assert.equal(terrain.length, 8);
    terrain.forEach((row) => assert.equal(row.length, 8));
    const byType = Object.fromEntries(
      ["grass", "water", "tree", "rock", "wall"].map((type) => [
        type,
        cells().filter(({ x, y }) => terrain[y][x] === type),
      ]),
    );
    assert.equal(
      Object.values(byType).reduce((sum, list) => sum + list.length, 0),
      64,
    );
    for (const type of ["tree", "rock", "wall"])
      assert.ok(byType[type].length >= 2, `${seed}: ${type} must appear`);
    assert.ok(byType.wall.length >= 3 && byType.wall.length <= 6);
    assert.ok(byType.rock.length <= 3);
    assert.ok(
      byType.water.length >= 6 && byType.water.length <= 20,
      `${seed}: ${byType.water.length} water`,
    );
    assert.equal(
      components(byType.water).length,
      1,
      `${seed}: connected water`,
    );
    assert.ok(
      components(byType.wall).every((group) => group.length >= 2),
      `${seed}: no lone wall`,
    );
    const walkable = [...byType.grass, ...byType.water];
    assert.equal(
      components(walkable).length,
      1,
      `${seed}: every walking tile is reachable`,
    );
    assert.deepEqual(Object.keys(spawns).sort(), [
      "earth",
      "enemy-1",
      "enemy-2",
      "enemy-3",
      "fire",
      "water",
    ]);
    assert.equal(new Set(Object.values(spawns).map(key)).size, 6);
    for (const spawn of Object.values(spawns))
      assert.equal(terrain[spawn.y][spawn.x], "grass");
    assert.ok(spawns.fire.x <= 3 && spawns.fire.y >= 4);
    const heroes = [spawns.fire, spawns.water, spawns.earth];
    const paths = new Map(heroes.map((hero) => [key(hero), 0]));
    const queue = heroes.slice();
    for (const current of queue)
      for (const next of neighbors(current)) {
        if (
          paths.has(key(next)) ||
          !["grass", "water"].includes(terrain[next.y][next.x])
        )
          continue;
        paths.set(key(next), paths.get(key(current)) + 1);
        queue.push(next);
      }
    for (const id of ["enemy-1", "enemy-2", "enemy-3"]) {
      assert.ok(
        Math.min(...heroes.map((hero) => distance(hero, spawns[id]))) >= 2,
      );
      assert.ok(
        paths.get(key(spawns[id])) >= 3 && paths.get(key(spawns[id])) <= 5,
        `${seed}: reachable first encounters`,
      );
    }
    const borderGrass = byType.grass.filter(
      (p) =>
        (p.x === 0 || p.y === 0 || p.x === 7 || p.y === 7) &&
        !Object.values(spawns).some((s) => key(s) === key(p)),
    );
    assert.ok(borderGrass.length >= 6, `${seed}: reinforcement entries`);
    if (waterKind === "lake") {
      assert.ok(
        byType.water.every((p) => p.x > 0 && p.y > 0 && p.x < 7 && p.y < 7),
      );
      assert.ok(
        byType.water.some((p) =>
          [
            [p.x + 1, p.y],
            [p.x, p.y + 1],
            [p.x + 1, p.y + 1],
          ].every(([x, y]) => terrain[y]?.[x] === "water"),
        ),
        `${seed}: lake has area`,
      );
    } else if (waterKind === "river") {
      assert.ok(
        (byType.water.some((p) => p.y === 0) &&
          byType.water.some((p) => p.y === 7)) ||
          (byType.water.some((p) => p.x === 0) &&
            byType.water.some((p) => p.x === 7)),
      );
      assert.ok(
        new Set(byType.water.map((p) => p.x)).size > 1 &&
          new Set(byType.water.map((p) => p.y)).size > 1,
      );
    } else {
      assert.equal(waterKind, "coast");
      assert.ok(
        [0, 1, 2, 3].some((side) =>
          Array.from({ length: 8 }, (_, i) =>
            side === 0
              ? terrain[i][0]
              : side === 1
                ? terrain[i][7]
                : side === 2
                  ? terrain[0][i]
                  : terrain[7][i],
          ).every((type) => type === "water"),
        ),
      );
      assert.ok(
        byType.water.some((p) => p.x > 0 && p.y > 0 && p.x < 7 && p.y < 7),
      );
    }
    signatures.add(JSON.stringify(terrain));
    kinds.add(waterKind);
    formations.add(JSON.stringify(spawns));
    assert.deepEqual(map, generateMap(`amostra-${seed}`));
  }
  assert.equal(kinds.size, 3);
  assert.equal(signatures.size, 400);
  assert.ok(formations.size >= 390);
});
