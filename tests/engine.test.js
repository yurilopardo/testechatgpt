import { classicOptions } from "./helpers/classic-map.js";
import test from "node:test";
import assert from "node:assert/strict";
import { positionOnPath } from "../src/art.js";
import {
  Battle,
  DIRECTIONS,
  SIZE,
  distance,
  initialTerrain,
  key,
} from "../src/engine.js";

// An open, controlled battlefield isolates interactions without depending on the mission layout.
function arena(element = "fire") {
  const b = new Battle(classicOptions({ waves: false, maxRounds: null }));
  b.terrain = Array.from({ length: 8 }, () => Array(8).fill("grass"));
  b.units = [
    {
      id: element,
      element,
      name: "Herói",
      team: "ally",
      x: 3,
      y: 3,
      hp: 3,
      maxHp: 3,
      range: 3,
      moved: false,
      acted: false,
    },
    {
      id: "enemy-1",
      name: "Inimigo",
      team: "enemy",
      x: 6,
      y: 3,
      hp: 2,
      maxHp: 2,
      range: 2,
      moved: false,
      acted: false,
      intent: { x: 5, y: 3 },
    },
  ];
  b.selectedId = element;
  b.mode = "move";
  b.barrier = null;
  b.phase = "player";
  b.log = [];
  return b;
}
const enemy = (id, x, y) => ({
  id,
  name: id,
  team: "enemy",
  x,
  y,
  hp: 2,
  maxHp: 2,
  range: 2,
  intent: null,
});
const ally = (id, x, y) => ({
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

test("mission: 64 cells, four tile types, continuous river, three valid allies and enemies", () => {
  const b = new Battle(classicOptions());
  assert.equal(b.terrain.flat().length, 64);
  assert.deepEqual(
    new Set(b.terrain.flat()),
    new Set(["grass", "water", "rock", "tree"]),
  );
  assert.equal(b.allies.length, 3);
  assert.equal(b.enemies.length, 3);
  assert.equal(new Set(b.units.map((u) => key(u.x, u.y))).size, 6);
  for (const u of b.units) assert.equal(b.obstacle(u.x, u.y), false);
  for (const e of b.enemies) {
    if (e.kind !== "ranged") assert.equal(distance(e, e.intent), 1);
    else assert.ok(e.intent && b.enemyAttackInRange(e));
  }
  const water = [];
  b.terrain.forEach((row, y) =>
    row.forEach((tile, x) => {
      if (tile === "water") water.push({ x, y });
    }),
  );
  const seen = new Set([key(water[0].x, water[0].y)]),
    queue = [water[0]];
  for (const p of queue)
    for (const [dx, dy] of DIRECTIONS) {
      const x = p.x + dx,
        y = p.y + dy,
        k = key(x, y);
      if (b.terrain[y]?.[x] === "water" && !seen.has(k)) {
        seen.add(k);
        queue.push({ x, y });
      }
    }
  assert.equal(seen.size, water.length);
  assert.ok(water.some((p) => p.y === 0));
  assert.ok(water.some((p) => p.y === 7));
});

test("Taro moves three steps like the other allies, can undo, and keeps his range across turns and resets", () => {
  const b = new Battle(classicOptions({ waves: false, maxRounds: null }));
  assert.deepEqual(
    b.allies.map((u) => [u.id, u.range]),
    [
      ["fire", 3],
      ["water", 3],
      ["earth", 3],
    ],
  );
  b.terrain = Array.from({ length: 8 }, () => Array(8).fill("grass"));
  const taro = b.allies.find((u) => u.id === "earth");
  Object.assign(taro, { x: 0, y: 0 });
  b.select("earth");
  assert.equal(b.reachable().get("3,0").path.length, 3);
  assert.equal(b.move(4, 0), false);
  assert.equal(b.move(3, 0), true);
  assert.equal(b.move(4, 0), false);
  assert.equal(b.undoMove(), true);
  assert.deepEqual([taro.x, taro.y, taro.moved], [0, 0, false]);
  assert.equal(b.move(3, 0), true);
  b.beginEnemyTurn();
  b.resolveEnemyTurn();
  assert.equal(taro.moved, false);
  assert.equal(taro.range, 3);
  assert.equal(b.reachable(taro).get("0,0").steps, 3);
  b.reset();
  assert.equal(b.allies.find((u) => u.id === "earth").range, 3);
  b.newMap("earth-three");
  assert.equal(b.allies.find((u) => u.id === "earth").range, 3);
});

test("movement: BFS honors three steps, obstacles, occupancy and orthogonal paths", () => {
  const b = arena();
  b.terrain[3][4] = "tree";
  b.terrain[2][3] = "rock";
  b.barrier = { x: 3, y: 4, hp: 2 };
  b.units.push(ally("water", 2, 3));
  assert.equal(b.reachable().size, 0);
  b.units.pop();
  const moves = b.reachable();
  assert.ok(moves.has("0,3"));
  assert.ok(!moves.has("4,3"));
  assert.ok(!moves.has("3,2"));
  assert.ok(!moves.has("3,4"));
  for (const p of moves.values()) {
    assert.ok(p.steps <= 3);
    let prev = b.selected;
    for (const step of p.path) {
      assert.equal(distance(prev, step), 1);
      prev = step;
    }
  }
});

test("water costs one movement step like grass", () => {
  const b = arena();
  b.terrain[3][2] = "water";
  b.terrain[3][1] = "water";
  b.terrain[3][0] = "water";
  assert.equal(b.reachable().get("0,3").steps, 3);
  assert.ok(b.move(0, 3));
});

test("movement and action budgets cannot be reused by reselecting or changing modes", () => {
  const b = arena();
  assert.ok(b.move(4, 3));
  assert.equal(b.move(5, 3), false);
  b.select("fire");
  b.setMode("move");
  assert.equal(b.move(5, 3), false);
  b.setMode("special");
  assert.ok(b.fire(6, 3));
  assert.equal(b.enemies[0].hp, 1);
  b.select("fire");
  assert.equal(b.fire(6, 3), false);
  assert.equal(b.move(5, 3), false);
  assert.equal(b.wait(), false);
});

test("an action without movement ends the unit turn", () => {
  const b = arena();
  assert.ok(b.fire(6, 3));
  assert.ok(b.selected.moved);
  assert.ok(b.selected.acted);
  assert.equal(b.move(2, 3), false);
});

test("punch deals one damage and pushes forward, rejecting diagonal and direct friendly attacks", () => {
  const b = arena();
  const target = b.enemies[0];
  target.x = 4;
  target.y = 4;
  assert.equal(b.punch(4, 4), false);
  target.y = 3;
  const friend = ally("water", 2, 3);
  b.units.push(friend);
  assert.equal(b.punch(2, 3), false);
  assert.equal(friend.hp, 3);
  assert.ok(b.punch(4, 3));
  assert.equal(target.hp, 1);
  assert.deepEqual([target.x, target.y], [5, 3]);
});

test("all three allies punch and push exactly one cell in each orthogonal direction", () => {
  for (const element of ["fire", "water", "earth"])
    for (const [dx, dy] of DIRECTIONS) {
      const b = arena(element),
        target = b.enemies[0];
      target.x = 3 + dx;
      target.y = 3 + dy;
      assert.ok(b.punch(target.x, target.y));
      assert.equal(target.hp, 1);
      assert.deepEqual([target.x, target.y], [3 + dx * 2, 3 + dy * 2]);
      assert.deepEqual([b.selected.x, b.selected.y], [3, 3]);
      assert.ok(b.selected.acted && b.selected.moved);
      b.select(element);
      assert.equal(b.punch(target.x, target.y), false);
    }
});

for (const blocker of ["edge", "enemy", "ally"]) {
  test(`punch blocked by ${blocker} applies collision damage only when another character is hit`, () => {
    const b = arena(),
      target = b.enemies[0];
    target.x = 4;
    let blockerUnit;
    if (blocker === "edge") {
      b.selected.x = 6;
      target.x = 7;
    } else {
      blockerUnit =
        blocker === "enemy" ? enemy("blocker", 5, 3) : ally("water", 5, 3);
      b.units.push(blockerUnit);
    }
    const origin = { x: target.x, y: target.y };
    const p = commitAndComparePreview(b, target.x, target.y, "punch");
    assert.deepEqual({ x: target.x, y: target.y }, origin);
    assert.equal(target.hp, blockerUnit ? 0 : 1);
    if (blockerUnit) {
      assert.equal(blockerUnit.hp, blockerUnit.maxHp - 1);
      assert.deepEqual([blockerUnit.x, blockerUnit.y], [5, 3]);
      assert.equal(p.units.length, 2);
      assert.equal(p.collisions[0].obstacleType, "unit");
    }
  });
}

for (const type of ["tree", "rock", "barrier"]) {
  test(`punch collision with ${type} adds one damage to enemy and structure`, () => {
    const b = arena(),
      target = b.enemies[0];
    target.x = 4;
    if (type === "barrier") b.barrier = { x: 5, y: 3, hp: 2, maxHp: 2, type };
    else b.terrain[3][5] = type;
    b.visualEvents = [];
    assert.ok(b.punch(4, 3));
    assert.equal(target.hp, 0);
    assert.equal(b.enemies.length, 0);
    assert.equal(b.structureAt(5, 3).hp, 1);
    assert.deepEqual([target.x, target.y], [4, 3]);
    assert.ok(
      b.visualEvents.some((e) => e.type === "collision" && e.id === target.id),
    );
    assert.equal(b.phase, "victory");
  });
}

test("punch can destroy a weakened structure without moving the enemy through it", () => {
  const b = arena(),
    target = b.enemies[0];
  target.x = 4;
  b.terrain[3][5] = "rock";
  b.structureAt(5, 3).hp = 1;
  b.punch(4, 3);
  assert.equal(target.hp, 0);
  assert.deepEqual([target.x, target.y], [4, 3]);
  assert.equal(b.terrain[3][5], "grass");
  assert.ok(b.free(5, 3));
});

test("a target defeated by the base punch still impacts the structure behind it", () => {
  const b = arena(),
    target = b.enemies[0];
  target.x = 4;
  target.hp = 1;
  b.terrain[3][5] = "tree";
  b.visualEvents = [];
  b.punch(4, 3);
  assert.equal(b.enemies.length, 0);
  assert.equal(b.structureAt(5, 3).hp, 1);
  assert.equal(
    b.visualEvents.some((e) => e.type === "push" || e.type === "collision"),
    true,
  );
});

test("punch can push into water while preserving the armed attack's direction", () => {
  const b = arena(),
    target = b.enemies[0];
  target.x = 4;
  target.intent = { x: 3, y: 3 };
  b.terrain[3][5] = "water";
  b.punch(4, 3);
  assert.deepEqual([target.x, target.y, target.hp], [5, 3, 1]);
  assert.deepEqual(target.intent, { x: 4, y: 3 });
  b.beginEnemyTurn();
  b.resolveEnemyTurn();
  assert.equal(b.selected.hp, 3);
  assert.equal(b.lastEffect.strikes[0].cancelled, undefined);
  assert.deepEqual(b.lastEffect.strikes[0].to, { x: 4, y: 3 });
});

for (const obstacle of ["tree", "rock", "barrier", "ally"])
  test(`fire is blocked by ${obstacle}`, () => {
    const b = arena();
    if (obstacle === "barrier") b.barrier = { x: 4, y: 3, hp: 2 };
    else if (obstacle === "ally") b.units.push(ally("water", 4, 3));
    else b.terrain[3][4] = obstacle;
    assert.equal(b.fire(6, 3), false);
    assert.equal(b.enemies[0].hp, 2);
    assert.equal(
      b.targets("special").some((p) => p.x >= 4 && p.y === 3),
      false,
    );
  });

test("fire hits first enemy only, in each of the four directions, at most four cells", () => {
  for (const [dx, dy] of DIRECTIONS) {
    const b = arena();
    b.units = b.allies;
    b.units.push(
      enemy("near", 3 + dx, 3 + dy),
      enemy("far", 3 + dx * 2, 3 + dy * 2),
    );
    assert.ok(b.fire(3 + dx, 3 + dy));
    assert.equal(b.enemies[0].hp, 1);
    assert.equal(b.enemies[1].hp, 2);
  }
  const b = arena();
  b.selected.x = 0;
  b.enemies[0].x = 5;
  assert.equal(b.fire(5, 3), false);
  b.enemies[0].x = 4;
  assert.ok(b.fire(4, 3));
  assert.equal(b.enemies[0].hp, 1);
});

test("fire rejects diagonals and keeps the unit action available after invalid input", () => {
  const b = arena();
  assert.equal(b.fire(4, 4), false);
  assert.equal(b.selected.acted, false);
});

test("wave pushes every adjacent enemy and ally, no damage and no diagonal effect", () => {
  const b = arena("water");
  b.units = b.allies;
  b.units.push(
    enemy("north", 3, 2),
    enemy("east", 4, 3),
    ally("fire", 3, 4),
    ally("earth", 2, 3),
    enemy("diagonal", 4, 4),
  );
  const before = b.units.map((u) => ({ id: u.id, hp: u.hp }));
  assert.ok(b.wave());
  for (const [id, x, y] of [
    ["north", 3, 1],
    ["east", 5, 3],
    ["fire", 3, 5],
    ["earth", 1, 3],
    ["diagonal", 4, 4],
  ]) {
    const u = b.units.find((u) => u.id === id);
    assert.deepEqual([u.x, u.y], [x, y]);
  }
  for (const p of before)
    assert.equal(b.units.find((u) => u.id === p.id).hp, p.hp);
});

test("wave activates only on the caster tile and previews the four orthogonal neighbors", () => {
  const b = arena("water");
  assert.deepEqual(b.targets("special"), [{ x: 3, y: 3 }]);
  assert.deepEqual(
    new Set(b.waveArea().map((p) => key(p.x, p.y))),
    new Set(["3,2", "4,3", "3,4", "2,3"]),
  );
  b.setMode("special");
  assert.equal(b.act(4, 3), false);
  assert.equal(b.selected.acted, false);
  assert.ok(b.act(3, 3));
  b.reset();
  b.select("water");
  b.selected.x = 0;
  b.selected.y = 0;
  assert.deepEqual(
    new Set(b.waveArea().map((p) => key(p.x, p.y))),
    new Set(["1,0", "0,1"]),
  );
});

test("damage feedback snapshots include lethal hits and survive subsequent position changes", () => {
  const b = arena();
  b.visualEvents = [];
  const target = b.enemies[0];
  b.damage(target, 1);
  const hit = b.visualEvents[0];
  assert.equal(hit.type, "damage");
  assert.equal(hit.amount, 1);
  assert.equal(hit.defeated, false);
  target.x = 5;
  assert.deepEqual(hit.at, { x: 6, y: 3 });
  assert.equal(hit.unit.x, 6);
  b.damage(target, 1);
  assert.equal(b.enemies.length, 0);
  assert.ok(b.visualEvents.at(-1).defeated);
  assert.equal(b.visualEvents.at(-1).unit.id, target.id);
  b.reset();
  assert.ok(b.visualEvents.every((e) => e.type !== "damage"));
});

test("enemy movement feedback records each actual orthogonal step", () => {
  const b = arena();
  b.visualEvents = [];
  b.terrain[3][5] = "rock";
  const from = { x: b.enemies[0].x, y: b.enemies[0].y };
  b.prepareEnemies();
  const movement = b.visualEvents.find((e) => e.type === "enemy-move");
  assert.deepEqual(movement.path[0], from);
  assert.ok(movement.path.length <= 3);
  for (let i = 1; i < movement.path.length; i++) {
    assert.equal(distance(movement.path[i - 1], movement.path[i]), 1);
    assert.equal(b.obstacle(movement.path[i].x, movement.path[i].y), false);
  }
  assert.deepEqual(movement.path.at(-1), {
    x: b.enemies[0].x,
    y: b.enemies[0].y,
  });
});

test("movement animation follows path corners instead of cutting diagonally through obstacles", () => {
  const path = [
    { x: 4, y: 1 },
    { x: 4, y: 2 },
    { x: 3, y: 2 },
  ];
  assert.deepEqual(positionOnPath(path, -1), path[0]);
  assert.deepEqual(positionOnPath(path, 0.5), { x: 4, y: 1.5 });
  assert.deepEqual(positionOnPath(path, 1.5), { x: 3.5, y: 2 });
  assert.deepEqual(positionOnPath(path, 3), path.at(-1));
});

for (const blocker of ["tree", "rock", "barrier", "unit", "edge"])
  test(`wave does not push into ${blocker}`, () => {
    const b = arena("water");
    const target = b.enemies[0];
    target.x = 4;
    if (blocker === "edge") {
      b.selected.x = 6;
      target.x = 7;
    } else if (blocker === "unit") b.units.push(enemy("blocker", 5, 3));
    else if (blocker === "barrier") b.barrier = { x: 5, y: 3, hp: 2 };
    else b.terrain[3][5] = blocker;
    const from = { x: target.x, y: target.y };
    assert.ok(b.wave());
    assert.deepEqual({ x: target.x, y: target.y }, from);
  });

for (const type of ["tree", "rock", "barrier"]) {
  test(`wave collision damages both enemy and ${type}, then clears the structure at zero HP`, () => {
    const b = arena("water"),
      target = b.enemies[0];
    target.x = 4;
    target.intent = { x: 3, y: 3 };
    if (type === "barrier") b.barrier = { x: 5, y: 3, hp: 2, maxHp: 2, type };
    else b.terrain[3][5] = type;

    assert.ok(b.wave());
    assert.equal(target.hp, 1);
    assert.equal(b.structureAt(5, 3).hp, 1);
    assert.deepEqual([target.x, target.y], [4, 3]);
    assert.ok(b.obstacle(5, 3));
    assert.equal(b.selected.hp, 3);
    assert.ok(b.selected.acted);
    assert.equal(b.wave(), false); // Damage cannot be repeated in the same turn.

    b.beginEnemyTurn();
    b.resolveEnemyTurn();
    assert.equal(b.selected.hp, 2); // A blocked shove does not cancel an adjacent attack.
    assert.ok(b.wave());
    assert.equal(b.enemies.length, 0);
    assert.equal(b.phase, "victory");
    assert.equal(b.structureAt(5, 3), null);
    assert.equal(b.terrain[3][5], "grass");
    assert.ok(b.free(5, 3));
    assert.ok(b.log.some((entry) => entry.text.includes("−1 PV em cada")));
  });
}

test("destroying a structure does not move a surviving enemy into the cleared cell", () => {
  const b = arena("water"),
    target = b.enemies[0];
  target.x = 4;
  b.terrain[3][5] = "rock";
  b.structureAt(5, 3).hp = 1;
  assert.ok(b.wave());
  assert.equal(target.hp, 1);
  assert.deepEqual([target.x, target.y], [4, 3]);
  assert.equal(b.terrain[3][5], "grass");
  assert.equal(b.obstacle(5, 3), false);
});

test("destroying a structure opens movement paths and fire lines immediately", () => {
  const b = arena("water");
  b.enemies[0].x = 4;
  b.terrain[3][5] = "tree";
  b.structureAt(5, 3).hp = 1;
  const fire = ally("fire", 5, 4);
  b.units.push(fire, enemy("far", 5, 2));
  b.select("fire");
  assert.equal(b.reachable().has("5,3"), false);
  assert.equal(
    b.targets("special").some((p) => p.x === 5 && p.y === 2),
    false,
  );
  b.select("water");
  b.wave();
  b.select("fire");
  assert.ok(b.reachable().has("5,3"));
  assert.ok(b.fire(5, 2));
  assert.equal(b.units.find((u) => u.id === "far").hp, 1);
});

test("one wave resolves multiple structure collisions and normal pushes together", () => {
  const b = arena("water");
  b.units = b.allies;
  const north = enemy("north", 3, 2),
    east = enemy("east", 4, 3),
    west = enemy("west", 2, 3);
  const friend = ally("fire", 3, 4);
  b.units.push(north, east, west, friend);
  b.terrain[1][3] = "tree";
  b.terrain[3][5] = "rock";
  b.structureAt(5, 3).hp = 1;
  b.wave();
  assert.deepEqual([north.x, north.y, north.hp], [3, 2, 1]);
  assert.deepEqual([east.x, east.y, east.hp], [4, 3, 1]);
  assert.deepEqual([west.x, west.y, west.hp], [1, 3, 2]);
  assert.deepEqual([friend.x, friend.y, friend.hp], [3, 5, 3]);
  assert.equal(b.structureAt(3, 1).hp, 1);
  assert.equal(b.structureAt(5, 3), null);
  assert.equal(b.lastEffect.collisions.length, 2);
});

for (const type of ["tree", "rock", "barrier"])
  test(`an ally colliding with ${type} damages both and stays in place`, () => {
    const b = arena("water");
    b.enemies[0].x = 7;
    const friend = ally("fire", 4, 3);
    b.units.push(friend);
    if (type === "barrier") b.barrier = { x: 5, y: 3, hp: 2, maxHp: 2, type };
    else b.terrain[3][5] = type;
    const p = commitAndComparePreview(b, 3, 3, "special");
    assert.deepEqual([friend.x, friend.y, friend.hp], [4, 3, 2]);
    assert.equal(b.structureAt(5, 3).hp, 1);
    assert.equal(p.units.find((u) => u.id === friend.id).hpAfter, 2);
    assert.equal(p.structures[0].hpAfter, 1);
    assert.ok(
      b.visualEvents.some((e) => e.type === "collision" && e.id === friend.id),
    );
    assert.ok(
      b.visualEvents.some((e) => e.type === "damage" && e.id === friend.id),
    );
  });

test("an ally and structure can both be destroyed by a collision without moving into the freed tile", () => {
  const b = arena("water");
  const friend = ally("fire", 4, 3);
  friend.hp = 1;
  b.units.push(friend);
  b.terrain[3][5] = "rock";
  b.structureAt(5, 3).hp = 1;
  const p = commitAndComparePreview(b, 3, 3, "special");
  assert.ok(p.units.find((u) => u.id === friend.id).defeated);
  assert.ok(p.structures[0].destroyed);
  assert.equal(b.units.includes(friend), false);
  assert.equal(b.structureAt(5, 3), null);
  assert.equal(b.terrain[3][5], "grass");
  assert.deepEqual([friend.x, friend.y], [4, 3]);
});

for (const pushedTeam of ["enemy", "ally"]) {
  for (const obstacleTeam of ["enemy", "ally"])
    test(`wave collision ${pushedTeam} against ${obstacleTeam} damages both without moving either character`, () => {
      for (const [dx, dy] of DIRECTIONS) {
        const b = arena("water");
        b.enemies[0].x = 7;
        b.enemies[0].y = 7;
        const target =
          pushedTeam === "enemy"
            ? enemy("pushed", 3 + dx, 3 + dy)
            : ally("fire", 3 + dx, 3 + dy);
        const obstacle =
          obstacleTeam === "enemy"
            ? enemy("blocker", 3 + 2 * dx, 3 + 2 * dy)
            : ally("earth", 3 + 2 * dx, 3 + 2 * dy);
        b.units.push(target, obstacle);
        const p = commitAndComparePreview(b, 3, 3, "special");
        assert.equal(target.hp, target.maxHp - 1);
        assert.equal(obstacle.hp, obstacle.maxHp - 1);
        assert.deepEqual([target.x, target.y], [3 + dx, 3 + dy]);
        assert.deepEqual([obstacle.x, obstacle.y], [3 + 2 * dx, 3 + 2 * dy]);
        assert.equal(p.pushes.length, 0);
        assert.equal(p.structures.length, 0);
        assert.equal(p.units.length, 2);
        assert.equal(p.collisions[0].obstacleId, obstacle.id);
        if (pushedTeam === "ally") assert.ok(!target.moved && !target.acted);
        if (obstacleTeam === "ally")
          assert.ok(!obstacle.moved && !obstacle.acted);
      }
    });

  test(`an ${pushedTeam} pushed against the board edge stays put without damage`, () => {
    const b = arena("water");
    b.selected.x = 6;
    const target = pushedTeam === "enemy" ? b.enemies[0] : ally("fire", 7, 3);
    if (pushedTeam === "ally") b.units.push(target);
    target.x = 7;
    const p = commitAndComparePreview(b, 6, 3, "special");
    assert.equal(target.hp, target.maxHp);
    assert.equal(target.x, 7);
    assert.equal(p.blocked[0].reason, "edge");
    assert.equal(p.collisions.length, 0);
  });
}

test("a lethal character collision removes both victims without pushing through to the next character", () => {
  const b = arena("water");
  const target = b.enemies[0];
  target.x = 4;
  target.hp = 1;
  const obstacle = ally("fire", 5, 3),
    beyond = ally("earth", 6, 3);
  obstacle.hp = 1;
  b.units.push(obstacle, beyond);
  const p = commitAndComparePreview(b, 3, 3, "special");
  assert.ok(p.units.every((u) => u.defeated));
  assert.equal(p.units.length, 2);
  assert.equal(b.phase, "victory");
  assert.equal(b.free(4, 3), true);
  assert.equal(b.free(5, 3), true);
  assert.deepEqual([beyond.x, beyond.y, beyond.hp], [6, 3, 3]);
  assert.equal(p.pushes.length, 0);
});

test("a punch that kills still damages a character standing behind the target", () => {
  const b = arena();
  b.enemies[0].x = 4;
  b.enemies[0].hp = 1;
  const obstacle = ally("water", 5, 3);
  b.units.push(obstacle);
  const p = commitAndComparePreview(b, 4, 3, "punch");
  assert.equal(obstacle.hp, 2);
  assert.equal(p.units.length, 2);
  assert.equal(p.collisions.length, 1);
});

test("reset restores destroyed and damaged structures with full HP", () => {
  const b = new Battle(classicOptions());
  const tree = b.structureAt(1, 0),
    rock = b.structureAt(2, 4);
  b.damage(tree, 2);
  b.damage(rock, 1);
  b.reset();
  assert.equal(b.terrain[0][1], "tree");
  assert.equal(b.terrain[4][2], "rock");
  assert.equal(b.structureAt(1, 0).hp, 2);
  assert.equal(b.structureAt(2, 4).hp, 2);
});

test("earth: overhead impact damages an occupied tile without pushing or creating a barrier", () => {
  const b = arena("earth");
  b.terrain[1][3] = "tree";
  b.terrain[2][3] = "wall";
  assert.equal(b.earth(4, 4), false);
  assert.equal(b.earth(3, 3), false);
  assert.equal(b.earth(3, 1), true);
  assert.equal(b.structureAt(3, 1).hp, 1);
  assert.equal(b.structureAt(3, 2).hp, 2);
  assert.equal(b.lastEffect.directHit, true);
  assert.equal(b.barrier, null);
});

test("barrier takes melee damage, moves and is removed at zero HP", () => {
  const b = arena();
  b.barrier = { x: 4, y: 3, hp: 2, maxHp: 2 };
  assert.ok(b.punch(4, 3));
  assert.equal(b.barrier.hp, 1);
  assert.equal(b.barrier.x, 5);
  b.selected.acted = false;
  b.selected.moved = false;
  assert.ok(b.move(4, 3));
  assert.ok(b.punch(5, 3));
  assert.equal(b.barrier, null);
});

test("announced attack stays on its cell, allowing a player to dodge", () => {
  const b = arena();
  const e = b.enemies[0];
  e.x = 4;
  e.intent = { x: 3, y: 3 };
  assert.ok(b.move(3, 4));
  assert.ok(b.beginEnemyTurn());
  assert.equal(b.move(3, 5), false);
  assert.ok(b.resolveEnemyTurn());
  assert.equal(b.allies[0].hp, 3);
  assert.equal(b.round, 2);
  assert.equal(b.phase, "player");
  assert.equal(b.allies[0].moved, false);
  assert.equal(b.allies[0].acted, false);
});

test("wave translates the armed melee attack instead of cancelling it", () => {
  const b = arena("water");
  const e = b.enemies[0];
  e.x = 4;
  e.intent = { x: 3, y: 3 };
  assert.ok(b.wave());
  assert.equal(e.x, 5);
  assert.deepEqual(e.intent, { x: 4, y: 3 });
  b.beginEnemyTurn();
  b.resolveEnemyTurn();
  assert.equal(b.allies[0].hp, 3);
  assert.equal(b.lastEffect.strikes[0].cancelled, undefined);
  assert.deepEqual(b.lastEffect.strikes[0].to, { x: 4, y: 3 });
});

test("enemy attacks damage a barrier and never bypass it to another cell", () => {
  const b = arena();
  const e = b.enemies[0];
  e.x = 5;
  e.intent = { x: 4, y: 3 };
  b.barrier = { x: 4, y: 3, hp: 2, maxHp: 2 };
  b.beginEnemyTurn();
  b.resolveEnemyTurn();
  assert.equal(b.barrier.hp, 1);
  assert.equal(b.allies[0].hp, 3);
});

test("enemy planning is deterministic, uses <=2 orthogonal steps, and announces an adjacent cell", () => {
  const a = arena(),
    b = arena();
  const start = { ...a.enemies[0] };
  a.prepareEnemies();
  b.prepareEnemies();
  assert.deepEqual(a.enemies, b.enemies);
  assert.ok(distance(start, a.enemies[0]) <= 2);
  assert.equal(distance(a.enemies[0], a.enemies[0].intent), 1);
  assert.equal(a.obstacle(a.enemies[0].x, a.enemies[0].y), false);
});

test("victory removes final enemy, prevents further input, and reset fully restores the mission", () => {
  const b = arena();
  b.enemies[0].x = 4;
  b.enemies[0].hp = 1;
  assert.ok(b.punch(4, 3));
  assert.equal(b.enemies.length, 0);
  assert.equal(b.phase, "victory");
  assert.equal(b.beginEnemyTurn(), false);
  b.reset();
  assert.equal(b.units.length, 6);
  assert.equal(b.round, 1);
  assert.equal(b.phase, "player");
  assert.equal(b.barrier, null);
  assert.ok(b.allies.every((u) => u.hp === 3 && !u.moved && !u.acted));
});

test("defeat after final ally dies, with no new player round", () => {
  const b = arena();
  b.selected.hp = 1;
  b.enemies[0].x = 4;
  b.enemies[0].intent = { x: 3, y: 3 };
  b.beginEnemyTurn();
  b.resolveEnemyTurn();
  assert.equal(b.allies.length, 0);
  assert.equal(b.phase, "defeat");
  assert.equal(b.round, 1);
});

test("a dead enemy cannot execute its announced attack", () => {
  const b = arena();
  const e = b.enemies[0];
  e.x = 4;
  e.hp = 1;
  e.intent = { x: 3, y: 3 };
  b.units.push(enemy("survivor", 7, 7));
  b.punch(4, 3);
  b.beginEnemyTurn();
  b.resolveEnemyTurn();
  assert.equal(b.allies[0].hp, 3);
});

test("an isolated battle can be won through legal moves and attacks, without mutating game state", () => {
  const b = new Battle(classicOptions({ waves: false, maxRounds: null }));
  // Simple deterministic player policy: attack if possible, otherwise advance toward the nearest enemy.
  for (let round = 0; round < 40 && b.phase === "player"; round++) {
    for (const id of ["fire", "water", "earth"]) {
      if (b.phase !== "player") break;
      if (!b.select(id) || b.selected.acted) continue;
      const attack = () => {
        const u = b.selected;
        const adjacent = b.enemies.find((e) => distance(u, e) === 1);
        if (adjacent) return b.punch(adjacent.x, adjacent.y);
        if (u.element === "fire") {
          const target = b
            .targets("special")
            .find((p) => b.unitAt(p.x, p.y)?.team === "enemy");
          if (target) return b.fire(target.x, target.y);
        }
        return false;
      };
      if (attack()) continue;
      const u = b.selected;
      const spots = [...b.reachable(u).values()];
      spots.sort(
        (a, c) =>
          Math.min(...b.enemies.map((e) => distance(a, e))) -
            Math.min(...b.enemies.map((e) => distance(c, e))) ||
          a.steps - c.steps,
      );
      if (spots.length) b.move(spots[0].x, spots[0].y);
      if (!attack()) b.wait();
    }
    if (b.phase === "player") {
      b.beginEnemyTurn();
      b.resolveEnemyTurn();
    }
  }
  assert.equal(b.phase, "victory");
  assert.ok(b.allies.length > 0);
});

// Compare forecasts with committed actions and the complete, real enemy resolution.
function commitAndComparePreview(b, x, y, mode = b.mode) {
  const snapshot = structuredClone(b),
    units = b.units,
    structures = b.structures;
  const prediction = b.previewAction(x, y, mode);
  assert.ok(prediction);
  assert.deepEqual(structuredClone(b), snapshot);
  assert.equal(b.units, units);
  assert.equal(b.structures, structures);
  b.setMode(mode);
  assert.ok(b.act(x, y));
  for (const unit of prediction.units) {
    const actual = b.units.find((u) => u.id === unit.id);
    assert.equal(actual?.hp || 0, unit.hpAfter);
    assert.deepEqual(actual ? { x: actual.x, y: actual.y } : null, unit.to);
  }
  for (const s of prediction.structures)
    assert.equal(b.structureAt(s.x, s.y)?.hp || 0, s.hpAfter);
  assert.equal(b.phase, prediction.outcome);
  if (prediction.nextEnemies.length) {
    b.visualEvents = [];
    assert.ok(b.beginEnemyTurn());
    assert.ok(b.resolveEnemyTurn());
    assert.equal(b.phase, prediction.forecastPhase);
    for (const next of prediction.nextEnemies) {
      const actual = b.units.find((u) => u.id === next.id);
      assert.deepEqual(actual ? { x: actual.x, y: actual.y } : null, next.to);
      const movement = b.visualEvents.find(
        (e) => e.type === "enemy-move" && e.id === next.id,
      );
      assert.deepEqual(movement?.path || [next.from], next.path);
    }
  }
  return prediction;
}

test("preview separates immediate knockback from the next enemy path without changing the battle", () => {
  const b = new Battle(classicOptions());
  b.setMode("punch");
  const original = structuredClone(b);
  for (let i = 0; i < 8; i++) assert.ok(b.previewAction(2, 5));
  assert.deepEqual(structuredClone(b), original);
  const p = commitAndComparePreview(b, 2, 5);
  assert.deepEqual(p.pushes[0].from, { x: 2, y: 5 });
  assert.deepEqual(p.pushes[0].to, { x: 3, y: 5 });
  assert.equal(p.units[0].damage, 1);
  assert.deepEqual(p.nextEnemies[0].path, [
    { x: 3, y: 5 },
    { x: 2, y: 5 },
  ]);
  assert.equal(p.nextEnemies[0].attackInterrupted, false);
});

test("preview matches punches in all four directions for each elemental character", () => {
  for (const element of ["fire", "water", "earth"])
    for (const [dx, dy] of DIRECTIONS) {
      const b = arena(element);
      b.enemies[0].x = 3 + dx;
      b.enemies[0].y = 3 + dy;
      b.enemies[0].intent = { x: 3, y: 3 };
      const p = commitAndComparePreview(b, 3 + dx, 3 + dy, "punch");
      assert.deepEqual(p.pushes[0].to, { x: 3 + dx * 2, y: 3 + dy * 2 });
      assert.equal(p.units[0].hpAfter, 1);
    }
});

for (const type of ["tree", "rock", "barrier"])
  test(`preview predicts lethal punch collision with ${type}`, () => {
    const b = arena();
    b.enemies[0].x = 4;
    if (type === "barrier") b.barrier = { x: 5, y: 3, hp: 2, maxHp: 2, type };
    else b.terrain[3][5] = type;
    const p = commitAndComparePreview(b, 4, 3, "punch");
    assert.equal(p.units[0].damage, 2);
    assert.ok(p.units[0].defeated);
    assert.equal(p.structures[0].hpAfter, 1);
    assert.equal(p.blocked[0].reason, "structure");
    assert.equal(p.nextEnemies.length, 0);
    assert.equal(p.outcome, "victory");
  });

test("preview predicts structure destruction and never invents a path for a defeated target", () => {
  const b = arena();
  b.enemies[0].x = 4;
  b.terrain[3][5] = "rock";
  b.structureAt(5, 3).hp = 1;
  const p = commitAndComparePreview(b, 4, 3, "punch");
  assert.ok(p.structures[0].destroyed);
  assert.equal(p.structures[0].hpAfter, 0);
  assert.equal(p.pushes.length, 0);
  assert.equal(p.nextEnemies.length, 0);
  const lethal = arena();
  lethal.enemies[0].x = 4;
  lethal.enemies[0].hp = 1;
  lethal.terrain[3][5] = "tree";
  const direct = commitAndComparePreview(lethal, 4, 3, "punch");
  assert.equal(direct.units[0].damage, 1);
  assert.equal(direct.structures.length, 1);
  assert.equal(direct.structures[0].hpAfter, 1);
  assert.equal(direct.collisions.length, 1);
});

for (const blocker of ["edge", "unit"])
  test(`preview explains a push blocked by ${blocker}`, () => {
    const b = arena();
    b.enemies[0].x = 4;
    if (blocker === "edge") {
      b.selected.x = 6;
      b.enemies[0].x = 7;
    } else b.units.push(ally("water", 5, 3));
    const p = commitAndComparePreview(b, b.enemies[0].x, 3, "punch");
    assert.equal(p.blocked[0].reason, blocker);
    assert.equal(p.units[0].damage, blocker === "unit" ? 2 : 1);
    assert.equal(p.pushes.length, 0);
    assert.equal(p.nextEnemies.length, 0);
  });

test("preview of fire hits only the first enemy and supports a shot into an empty line", () => {
  const b = arena();
  b.enemies[0].x = 4;
  b.units.push(enemy("far", 5, 3));
  const p = commitAndComparePreview(b, 4, 3, "special");
  assert.equal(p.units.length, 1);
  assert.equal(p.units[0].damage, 1);
  assert.deepEqual(p.effect.to, { x: 4, y: 3 });
  assert.equal(p.nextEnemies.length, 0);
  const empty = arena();
  const shot = commitAndComparePreview(empty, 3, 2, "special");
  assert.equal(shot.units.length, 0);
  assert.deepEqual(shot.effect.to, { x: 3, y: 0 });
});

test("wave preview includes allies, simultaneous collisions and a newly cleared structure", () => {
  const b = arena("water");
  b.units = b.allies;
  b.units.push(enemy("north", 3, 2), enemy("east", 4, 3), ally("earth", 3, 4));
  b.terrain[1][3] = "tree";
  b.structureAt(3, 1).hp = 1;
  const p = commitAndComparePreview(b, 3, 3, "special");
  assert.equal(p.units.find((u) => u.id === "north").hpAfter, 1);
  assert.equal(p.units.find((u) => u.id === "earth").damage, 0);
  assert.ok(p.units.find((u) => u.id === "earth").moved);
  assert.ok(p.structures[0].destroyed);
  assert.deepEqual(
    p.nextEnemies.map((e) => e.id),
    ["east"],
  );
});

test("preview retains an enemy displaced next to another ally without inventing movement", () => {
  const b = arena("water");
  b.enemies[0].x = 4;
  b.enemies[0].intent = { x: 3, y: 3 };
  b.units.push(ally("fire", 6, 3));
  const p = commitAndComparePreview(b, 3, 3, "special");
  assert.equal(p.nextEnemies[0].status, "stays");
  assert.deepEqual(p.nextEnemies[0].to, { x: 5, y: 3 });
  assert.deepEqual(p.nextEnemies[0].path, [{ x: 5, y: 3 }]);
});

test("preview resolves announced attacks before forecasting the next movement", () => {
  const b = arena("water");
  b.enemies[0].x = 4;
  b.enemies[0].hp = 1;
  b.enemies[0].intent = { x: 3, y: 3 };
  const attacker = enemy("attacker", 5, 2);
  attacker.intent = { x: 5, y: 3 };
  b.units.push(attacker);
  const p = commitAndComparePreview(b, 3, 3, "special");
  assert.equal(p.units.find((u) => u.id === "enemy-1").hpAfter, 1); // Survives the wave itself.
  assert.equal(p.nextEnemies[0].status, "defeated"); // Dies to a later announced strike.
  assert.equal(p.nextEnemies[0].to, null);
});

test("preview does not show enemy advance when the announced attacks end the battle", () => {
  const b = arena("water");
  b.selected.hp = 1;
  b.enemies[0].x = 4;
  b.enemies[0].intent = { x: 3, y: 3 };
  const attacker = enemy("north", 3, 2);
  attacker.intent = { x: 3, y: 3 };
  b.units.push(attacker);
  b.terrain[1][3] = "tree";
  const p = commitAndComparePreview(b, 3, 3, "special");
  assert.equal(p.forecastPhase, "defeat");
  assert.equal(p.nextEnemies[0].status, "battle-ended");
  assert.deepEqual(p.nextEnemies[0].path, [{ x: 5, y: 3 }]);
});

test("earth preview shows direct structure damage and preserves an unrelated barrier", () => {
  const b = arena("earth");
  b.barrier = { x: 0, y: 0, hp: 1, maxHp: 2, type: "barrier" };
  b.terrain[3][2] = "tree";
  const p = commitAndComparePreview(b, 2, 3, "special");
  assert.equal(p.units.length, 1);
  assert.equal(p.units[0].moved, true);
  assert.equal(p.structures.length, 1);
  assert.equal(p.structures[0].hpAfter, 1);
  assert.equal(p.structures[0].created, false);
  assert.equal(b.barrier.hp, 1);
});

test("invalid, blocked and spent actions never produce a forecast or mutate state", () => {
  const b = arena();
  b.terrain[3][4] = "tree";
  const before = structuredClone(b);
  for (const [x, y, mode] of [
    [6, 3, "special"],
    [2, 3, "punch"],
    [-1, 3, "special"],
    [3, 3, "move"],
  ])
    assert.equal(b.previewAction(x, y, mode), null);
  assert.deepEqual(structuredClone(b), before);
  const water = arena("water");
  assert.equal(water.previewAction(4, 3, "special"), null);
  water.wait();
  assert.equal(water.previewAction(3, 3, "special"), null);
  const earth = arena("earth");
  earth.terrain[3][2] = "water";
  assert.equal(earth.previewAction(2, 2, "special"), null);
  b.beginEnemyTurn();
  assert.equal(b.previewAction(3, 2, "special"), null);
});

test("a later action recalculates predictions instead of retaining stale enemy health", () => {
  const b = new Battle(classicOptions());
  b.setMode("punch");
  const first = b.previewAction(2, 5);
  b.select("water");
  b.wave();
  b.select("fire");
  b.setMode("punch");
  const second = b.previewAction(2, 5);
  assert.equal(first.units[0].hpBefore, 2);
  assert.equal(first.units[0].hpAfter, 1);
  assert.equal(second.units[0].hpBefore, 1);
  assert.equal(second.units[0].hpAfter, 0);
  assert.equal(second.nextEnemies.length, 0);
});
