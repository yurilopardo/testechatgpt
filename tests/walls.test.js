import test from "node:test";
import assert from "node:assert/strict";
import {
  Battle,
  DIRECTIONS,
  SIZE,
  initialTerrain,
  key,
} from "../src/engine.js";
import { generateMap, normalizeSeed } from "../src/maps.js";

const grass = () =>
  Array.from({ length: SIZE }, () => Array(SIZE).fill("grass"));
const hero = (id, x, y) => ({
  id,
  element: id,
  name: id,
  team: "ally",
  x,
  y,
  hp: 3,
  maxHp: 3,
  range: 3,
  moved: false,
  acted: false,
});
const foe = (id, x, y, kind = "melee") => ({
  id,
  name: id,
  team: "enemy",
  kind,
  x,
  y,
  hp: kind === "ranged" ? 1 : 2,
  maxHp: kind === "ranged" ? 1 : 2,
  range: 2,
  attackRange: kind === "ranged" ? 4 : 1,
  intent: null,
});

function arena(element = "fire") {
  const b = new Battle({ terrain: grass(), waves: false, maxRounds: null });
  b.terrain = grass();
  b.structures.clear();
  b.barrier = null;
  b.units = [hero(element, 3, 3), foe("distant", 7, 7)];
  b.selectedId = element;
  b.mode = "move";
  b.phase = "player";
  b.visualEvents = [];
  b.log = [];
  return b;
}

function structure(b, type, x, y, hp = 2) {
  if (type === "barrier")
    b.barrier = { x, y, type, name: "Barreira de Terra", hp, maxHp: 2 };
  else b.terrain[y][x] = type;
  const target = b.structureAt(x, y);
  assert.ok(target, `${type} must be a combat structure`);
  target.hp = hp;
  return target;
}

function previewAndCommit(b, x, y, mode = "punch") {
  assert.equal(b.setMode(mode), true);
  const before = structuredClone(b),
    units = b.units,
    structures = b.structures,
    preview = b.previewAction(x, y);
  assert.ok(preview);
  assert.deepEqual(
    structuredClone(b),
    before,
    "a forecast cannot alter the battle",
  );
  assert.equal(b.units, units);
  assert.equal(b.structures, structures);
  assert.equal(b.act(x, y), true);
  for (const entry of preview.structures) {
    const actual = [
      ...b.structures.values(),
      ...(b.barrier ? [b.barrier] : []),
    ].find((candidate) => candidate.id === entry.id);
    assert.equal(actual?.hp || 0, entry.hpAfter);
    if (actual && entry.to)
      assert.deepEqual({ x: actual.x, y: actual.y }, entry.to);
  }
  for (const entry of preview.units) {
    const actual = b.units.find((candidate) => candidate.id === entry.id);
    assert.equal(actual?.hp || 0, entry.hpAfter);
    if (actual) assert.deepEqual({ x: actual.x, y: actual.y }, entry.to);
  }
  return preview;
}

function missionSnapshot(b) {
  return structuredClone({
    mapSeed: b.mapSeed,
    waterKind: b.waterKind,
    terrain: b.terrain,
    units: b.units,
    structures: b.structures,
    round: b.round,
    phase: b.phase,
    selectedId: b.selectedId,
    mode: b.mode,
    reinforcementQueue: b.reinforcementQueue,
    totalEnemies: b.totalEnemies,
    kills: b.kills,
    resultReason: b.resultReason,
  });
}

test("wall: ruined masonry has two HP and cannot be moved directly", () => {
  const b = arena(),
    wall = structure(b, "wall", 4, 3);
  assert.equal(wall.name, "Muralha em ruínas");
  assert.equal(wall.type, "wall");
  assert.equal(wall.hp, 2);
  assert.equal(wall.maxHp, 2);
  assert.equal(b.movableStructureAt(4, 3), null);
  assert.equal(b.moveStructure(wall, { x: 5, y: 3 }), false);
  assert.equal(b.structureAt(4, 3), wall);
  assert.equal(b.structureAt(5, 3), null);
  assert.equal(
    b.visualEvents.some((event) => event.type === "structure-push"),
    false,
  );
});

test("wall: allies and enemies must walk around it until it is destroyed", () => {
  const b = arena(),
    wall = structure(b, "wall", 4, 3);
  const walker = foe("walker", 5, 3);
  b.units.push(walker);
  assert.equal(b.obstacle(4, 3), true);
  assert.equal(b.free(4, 3), false);
  assert.equal(b.reachable(b.selected, 1).has(key(4, 3)), false);
  assert.equal(b.reachable(walker, 1).has(key(4, 3)), false);
  assert.equal(b.move(4, 3), false);
  for (const route of b.reachable(b.selected, 8).values())
    assert.equal(
      route.path.some((p) => p.x === 4 && p.y === 3),
      false,
    );
  b.damage(wall, 2);
  assert.equal(b.terrain[3][4], "grass");
  assert.equal(b.obstacle(4, 3), false);
  assert.equal(b.reachable(b.selected, 1).has(key(4, 3)), true);
  assert.equal(b.reachable(walker, 1).has(key(4, 3)), true);
  assert.equal(b.move(4, 3), true);
});

test("wall: every character can punch it in each direction without pushing it", () => {
  for (const element of ["fire", "water", "earth"])
    for (const [dx, dy] of DIRECTIONS) {
      const b = arena(element),
        x = 3 + dx,
        y = 3 + dy;
      const wall = structure(b, "wall", x, y);
      assert.ok(b.targets("punch").some((p) => p.x === x && p.y === y));
      const preview = previewAndCommit(b, x, y);
      assert.equal(b.structureAt(x, y), wall);
      assert.equal(wall.hp, 1);
      assert.deepEqual([wall.x, wall.y], [x, y]);
      assert.equal(preview.structures.length, 1);
      assert.equal(preview.structures[0].hpBefore, 2);
      assert.equal(preview.structures[0].hpAfter, 1);
      assert.equal(preview.structures[0].moved, false);
      assert.equal(preview.structures[0].destroyed, false);
      assert.deepEqual(preview.structureMoves, []);
      assert.deepEqual(preview.collisions, []);
      assert.deepEqual(preview.blocked, []);
      assert.equal(b.selected.acted, true);
    }
});

test("wall: a second ally's punch destroys it and the preview releases its cell", () => {
  const b = arena(),
    wall = structure(b, "wall", 4, 3);
  b.units.push(hero("water", 4, 4));
  previewAndCommit(b, 4, 3);
  assert.equal(b.select("water"), true);
  const preview = previewAndCommit(b, 4, 3);
  assert.equal(preview.structures[0].hpBefore, 1);
  assert.equal(preview.structures[0].hpAfter, 0);
  assert.equal(preview.structures[0].destroyed, true);
  assert.deepEqual(preview.structureMoves, []);
  assert.equal(wall.hp, 0);
  assert.equal(b.structureAt(4, 3), null);
  assert.equal(b.structures.has(key(4, 3)), false);
  assert.equal(b.terrain[3][4], "grass");
  assert.equal(b.free(4, 3), true);
});

test("wall: the circular wave leaves adjacent masonry intact", () => {
  for (const [dx, dy] of DIRECTIONS) {
    const b = arena("water"),
      wall = structure(b, "wall", 3 + dx, 3 + dy);
    const preview = previewAndCommit(b, 3, 3, "special");
    assert.equal(b.structureAt(3 + dx, 3 + dy), wall);
    assert.equal(wall.hp, 2);
    assert.deepEqual(preview.structures, []);
    assert.deepEqual(preview.structureMoves, []);
    assert.deepEqual(preview.collisions, []);
    assert.deepEqual(preview.blocked, []);
  }
});

for (const team of ["ally", "enemy"])
  test(`wall: a ${team} colliding after a wave damages both and never advances through a destroyed wall`, () => {
    for (const wallHp of [1, 2]) {
      const b = arena("water"),
        wall = structure(b, "wall", 5, 3, wallHp);
      const target = team === "ally" ? hero("fire", 4, 3) : foe("target", 4, 3);
      b.units.push(target);
      const preview = previewAndCommit(b, 3, 3, "special");
      assert.deepEqual(
        [target.x, target.y, target.hp],
        [4, 3, target.maxHp - 1],
      );
      assert.equal(wall.hp, wallHp - 1);
      assert.equal(b.structureAt(5, 3), wallHp === 1 ? null : wall);
      assert.equal(b.unitAt(5, 3), null);
      assert.equal(preview.collisions.length, 1);
      assert.equal(preview.collisions[0].obstacleType, "structure");
      assert.equal(preview.collisions[0].obstacleId, wall.id);
      assert.deepEqual(preview.pushes, []);
      assert.deepEqual(preview.structureMoves, []);
    }
  });

test("wall: punching an enemy into it adds collision damage to the base hit", () => {
  const b = arena(),
    wall = structure(b, "wall", 5, 3);
  const enemy = foe("target", 4, 3);
  b.units.push(enemy);
  const preview = previewAndCommit(b, 4, 3);
  assert.equal(enemy.hp, 0);
  assert.equal(b.unitAt(4, 3), null);
  assert.equal(wall.hp, 1);
  assert.equal(b.structureAt(5, 3), wall);
  assert.equal(preview.units.find((entry) => entry.id === enemy.id).damage, 2);
  assert.equal(preview.collisions.length, 1);
  assert.equal(preview.structureMoves.length, 0);
  assert.equal(b.kills, 1);
});

for (const type of ["rock", "barrier"]) {
  test(`wall: a wave-driven ${type} damages both structures without a chain push`, () => {
    for (const wallHp of [1, 2]) {
      const b = arena("water"),
        target = structure(b, type, 4, 3);
      const wall = structure(b, "wall", 5, 3, wallHp);
      const preview = previewAndCommit(b, 3, 3, "special");
      assert.equal(target.hp, 1);
      assert.equal(b.structureAt(4, 3), target);
      assert.equal(wall.hp, wallHp - 1);
      assert.equal(b.structureAt(5, 3), wallHp === 1 ? null : wall);
      assert.equal(b.structureAt(6, 3), null);
      assert.equal(preview.collisions.length, 1);
      assert.equal(preview.structures.length, 2);
      assert.deepEqual(preview.structureMoves, []);
    }
  });

  test(`wall: punching a ${type} into masonry destroys the pushed structure after two damage`, () => {
    const b = arena(),
      target = structure(b, type, 4, 3);
    const wall = structure(b, "wall", 5, 3);
    const preview = previewAndCommit(b, 4, 3);
    assert.equal(target.hp, 0);
    assert.equal(b.structureAt(4, 3), null);
    assert.equal(wall.hp, 1);
    assert.equal(b.structureAt(5, 3), wall);
    assert.equal(
      preview.structures.find((entry) => entry.id === target.id).hpAfter,
      0,
    );
    assert.equal(
      preview.structures.find((entry) => entry.id === wall.id).hpAfter,
      1,
    );
    assert.equal(preview.collisions.length, 1);
    assert.deepEqual(preview.structureMoves, []);
  });
}

test("wall: fire cannot target or cross masonry and does not damage it", () => {
  const b = arena();
  b.selected.x = 1;
  Object.assign(b.enemies[0], { x: 5, y: 3 });
  const wall = structure(b, "wall", 3, 3);
  assert.equal(
    b.targets("special").some((p) => p.x >= 3 && p.y === 3),
    false,
  );
  assert.equal(b.previewAction(3, 3, "special"), null);
  assert.equal(b.fire(3, 3), false);
  assert.equal(b.selected.acted, false);
  const preview = previewAndCommit(b, 2, 3, "special");
  assert.equal(wall.hp, 2);
  assert.equal(b.enemies[0].hp, 2);
  assert.deepEqual(preview.structures, []);
  assert.deepEqual(preview.units, []);
  assert.deepEqual(b.lastEffect.to, { x: 2, y: 3 });
  b.damage(wall, 2);
  b.selected.acted = false;
  assert.ok(b.targets("special").some((p) => p.x === 5 && p.y === 3));
  previewAndCommit(b, 5, 3, "special");
  assert.equal(b.enemies[0].hp, 1);
});

test("wall: a ranged enemy's announced shot is blocked without damaging masonry", () => {
  const b = arena();
  Object.assign(b.selected, { x: 5, y: 3 });
  const ranged = foe("archer", 1, 3, "ranged");
  ranged.intent = { x: 5, y: 3 };
  b.units = [b.selected, ranged];
  const wall = structure(b, "wall", 3, 3);
  assert.equal(b.enemyAttackInRange(ranged), true);
  assert.equal(b.enemyAttackValid(ranged), false);
  assert.equal(b.beginEnemyTurn(), true);
  assert.equal(b.resolveEnemyTurn(), true);
  assert.equal(b.allies[0].hp, 3);
  assert.equal(wall.hp, 2);
  assert.equal(b.structureAt(3, 3), wall);
});

test("wall: destroying masonry immediately opens a ranged enemy's line of sight", () => {
  const b = arena();
  Object.assign(b.selected, { x: 5, y: 3 });
  const ranged = foe("archer", 1, 3, "ranged");
  ranged.intent = { x: 5, y: 3 };
  b.units = [b.selected, ranged];
  const wall = structure(b, "wall", 3, 3);
  assert.equal(b.enemyAttackValid(ranged), false);
  b.damage(wall, 2);
  assert.equal(b.enemyAttackValid(ranged), true);
  assert.equal(b.beginEnemyTurn(), true);
  assert.equal(b.resolveEnemyTurn(), true);
  assert.equal(b.allies[0].hp, 2);
});

test("wall: newly obstructed origin or return path prevents undo until cleared", () => {
  for (const x of [3, 4]) {
    const b = arena();
    assert.equal(b.move(5, 3), true);
    assert.equal(b.canUndoMove(), true);
    const wall = structure(b, "wall", x, 3);
    assert.equal(b.canUndoMove(), false);
    assert.equal(b.undoMove(), false);
    assert.deepEqual([b.selected.x, b.selected.y], [5, 3]);
    b.damage(wall, 2);
    assert.equal(b.canUndoMove(), true);
    assert.equal(b.undoMove(), true);
    assert.deepEqual([b.selected.x, b.selected.y], [3, 3]);
  }
});

test("procedural battle: the default mission uses a reproducible generated map", () => {
  const b = new Battle();
  assert.equal(typeof b.mapSeed, "string");
  assert.ok(b.mapSeed.length);
  const generated = generateMap(b.mapSeed);
  assert.deepEqual(b.terrain, generated.terrain);
  assert.equal(b.waterKind, generated.waterKind);
  assert.ok(b.terrain.flat().includes("wall"));
  for (const ally of b.allies)
    assert.deepEqual({ x: ally.x, y: ally.y }, generated.spawns[ally.id]);
  assert.deepEqual(
    missionSnapshot(b),
    missionSnapshot(new Battle({ seed: b.mapSeed })),
  );
});

test("procedural battle: a normalized seed reproduces terrain, prepared enemies and intentions", () => {
  const seed = "  Ruínas São Jorge! ",
    b = new Battle({ seed });
  assert.equal(b.mapSeed, normalizeSeed(seed));
  assert.deepEqual(b.terrain, generateMap(seed).terrain);
  assert.deepEqual(
    missionSnapshot(b),
    missionSnapshot(new Battle({ seed: normalizeSeed(seed) })),
  );
  assert.deepEqual(missionSnapshot(b), missionSnapshot(new Battle({ seed })));
});

test("procedural battle: reset restores the same layout and full wall HP", () => {
  const b = new Battle({ seed: "repetir-ruinas" }),
    initial = missionSnapshot(b);
  const wall = [...b.structures.values()].find(
    (entry) => entry.type === "wall",
  );
  assert.ok(wall);
  b.damage(wall, 2);
  b.allies[0].hp = 1;
  b.round = 4;
  b.reinforcementQueue.splice(0, 2);
  b.phase = "defeat";
  b.kills = 7;
  b.barrier = { type: "barrier", x: 0, y: 0, hp: 1, maxHp: 2 };
  b.reset();
  assert.deepEqual(missionSnapshot(b), initial);
  assert.equal(b.barrier, null);
  assert.equal(b.structureAt(wall.x, wall.y).hp, 2);
});

test("procedural battle: requesting another seed starts a fresh mission on another board", () => {
  const b = new Battle({ seed: "primeiro-tabuleiro" }),
    before = b.terrain;
  b.round = 5;
  b.phase = "defeat";
  b.kills = 8;
  b.allies.forEach((unit) => {
    unit.hp = 1;
    unit.acted = true;
    unit.moved = true;
  });
  b.reinforcementQueue = [];
  b.newMap("segundo-tabuleiro");
  assert.equal(b.mapSeed, "segundo-tabuleiro");
  assert.notDeepEqual(b.terrain, before);
  assert.deepEqual(
    missionSnapshot(b),
    missionSnapshot(new Battle({ seed: "segundo-tabuleiro" })),
  );
  assert.equal(b.round, 1);
  assert.equal(b.phase, "player");
  assert.equal(b.pendingReinforcements, 6);
  assert.equal(b.kills, 0);
  assert.equal(
    b.allies.every(
      (unit) => unit.hp === unit.maxHp && !unit.acted && !unit.moved,
    ),
    true,
  );
});

test("procedural battle: a new map without a seed gets its own repeatable code", () => {
  const b = new Battle({ seed: "mapa-anterior" });
  b.newMap();
  assert.notEqual(b.mapSeed, "mapa-anterior");
  const firstCode = b.mapSeed,
    initial = missionSnapshot(b);
  b.reset();
  assert.deepEqual(missionSnapshot(b), initial);
  b.newMap();
  assert.notEqual(b.mapSeed, firstCode);
  assert.deepEqual(
    missionSnapshot(b),
    missionSnapshot(new Battle({ seed: b.mapSeed })),
  );
});

test("procedural battle: cloning and forecasting preserve the seeded mission", () => {
  const b = new Battle({ seed: "sem-sortear-ao-prever" }),
    before = structuredClone(b);
  const fork = b.fork();
  fork.reset();
  assert.deepEqual(missionSnapshot(fork), missionSnapshot(b));
  assert.deepEqual(structuredClone(b), before);
  for (const ally of b.allies) {
    assert.equal(b.select(ally.id), true);
    const snapshot = structuredClone(b);
    for (const point of b.targets("special"))
      b.previewAction(point.x, point.y, "special");
    assert.deepEqual(structuredClone(b), snapshot);
  }
  b.reset();
  assert.deepEqual(
    missionSnapshot(b),
    missionSnapshot(new Battle({ seed: "sem-sortear-ao-prever" })),
  );
});

test("procedural battle: caller-owned terrain and spawn objects remain independent", () => {
  const terrain = grass(),
    spawns = {
      fire: { x: 5, y: 5 },
      water: { x: 5, y: 6 },
      earth: { x: 4, y: 7 },
      "enemy-1": { x: 1, y: 0 },
      "enemy-2": { x: 2, y: 0 },
      "enemy-3": { x: 0, y: 7 },
    };
  terrain[1][0] = "wall";
  const b = new Battle({ terrain, spawns, seed: "cenario-personalizado" });
  const original = missionSnapshot(b);
  for (const ally of b.allies)
    assert.deepEqual({ x: ally.x, y: ally.y }, spawns[ally.id]);
  terrain[1][0] = "grass";
  spawns.fire.x = 99;
  assert.equal(b.terrain[1][0], "wall");
  assert.equal(b.allies.find((unit) => unit.id === "fire").x, 5);
  b.damage(b.structureAt(0, 1), 2);
  b.reset();
  assert.deepEqual(missionSnapshot(b), original);
});

test("procedural battle: supplied fixture terrain retains the classic formation", () => {
  const b = new Battle({ terrain: initialTerrain(), seed: "classic" });
  assert.deepEqual(b.terrain, initialTerrain());
  assert.deepEqual(
    b.allies.map(({ id, x, y }) => ({ id, x, y })),
    [
      { id: "fire", x: 1, y: 5 },
      { id: "water", x: 2, y: 6 },
      { id: "earth", x: 1, y: 7 },
    ],
  );
  const before = missionSnapshot(b);
  b.reset();
  assert.deepEqual(missionSnapshot(b), before);
  b.newMap("procedural-depois-do-classico");
  assert.deepEqual(
    b.terrain,
    generateMap("procedural-depois-do-classico").terrain,
  );
  assert.ok(b.terrain.flat().includes("wall"));
});
