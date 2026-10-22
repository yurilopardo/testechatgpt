import { classicOptions } from "./helpers/classic-map.js";
import test from "node:test";
import assert from "node:assert/strict";
import { Battle, SIZE, distance, key } from "../src/engine.js";
import { MISSION_WIN_STEPS, replayMission } from "./helpers/mission-policy.js";

const hero = (id = "fire", x = 2, y = 3) => ({
  id,
  name: id,
  element: id,
  team: "ally",
  x,
  y,
  hp: 3,
  maxHp: 3,
  range: 3,
  moved: false,
  acted: false,
});
const foe = (id = "ranged", x = 6, y = 3, kind = "ranged") => ({
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
  intent: { x: 2, y: 3 },
});

function arena() {
  const b = new Battle(classicOptions({ waves: false, maxRounds: null }));
  b.terrain = Array.from({ length: SIZE }, () => Array(SIZE).fill("grass"));
  b.structures.clear();
  b.barrier = null;
  b.units = [hero(), foe()];
  b.selectedId = "fire";
  b.mode = "move";
  b.phase = "player";
  b.log = [];
  b.visualEvents = [];
  return b;
}

function endTurn(b) {
  assert.equal(b.beginEnemyTurn(), true);
  assert.equal(b.resolveEnemyTurn(), true);
}

function defeatPresentEnemies(b) {
  for (const enemy of [...b.enemies]) b.damage(enemy, enemy.hp);
  b.checkResult();
}

test("mission: five rounds, nine enemies and the next wave are explicit", () => {
  const b = new Battle(classicOptions());
  assert.equal(b.maxRounds, 5);
  assert.equal(b.round, 1);
  assert.equal(b.totalEnemies, 9);
  assert.equal(b.kills, 0);
  assert.equal(b.pendingReinforcements, 6);
  assert.equal(b.nextWaveCount, 1);
  assert.equal(b.enemies.filter((e) => e.kind === "ranged").length, 1);
  const ranged = b.enemies.find((e) => e.kind === "ranged");
  assert.equal(ranged.hp, 1);
  assert.equal(ranged.maxHp, 1);
  assert.equal(ranged.range, 2);
  assert.equal(b.enemies.filter((e) => e.kind !== "ranged").length, 2);
});

test("mission: clearing the field does not win while reinforcements are pending", () => {
  const b = new Battle(classicOptions());
  defeatPresentEnemies(b);
  assert.equal(b.enemies.length, 0);
  assert.equal(b.kills, 3);
  assert.equal(b.phase, "player");
  assert.equal(b.pendingReinforcements, 6);
  endTurn(b);
  assert.equal(b.round, 2);
  assert.equal(b.phase, "player");
  assert.equal(b.enemies.length, 1);
  assert.equal(b.pendingReinforcements, 5);
});

test("mission: deterministic waves contain 1, 2, 1 and 2 new enemies", () => {
  const b = new Battle(classicOptions());
  const allIds = new Set(b.enemies.map((e) => e.id));
  let expectedKills = 0;
  for (const [index, expectedCount] of [1, 2, 1, 2].entries()) {
    assert.equal(b.nextWaveCount, expectedCount);
    expectedKills += b.enemies.length;
    defeatPresentEnemies(b);
    assert.equal(b.phase, "player");
    endTurn(b);
    assert.equal(b.round, index + 2);
    assert.equal(b.enemies.length, expectedCount);
    assert.equal(b.kills, expectedKills);
    for (const e of b.enemies) {
      assert.equal(allIds.has(e.id), false);
      allIds.add(e.id);
      assert.equal(b.obstacle(e.x, e.y), false);
      assert.equal(
        b.units.filter((u) => key(u.x, u.y) === key(e.x, e.y)).length,
        1,
      );
    }
  }
  assert.equal(allIds.size, 9);
  assert.equal(b.pendingReinforcements, 0);
  assert.equal(b.nextWaveCount, 0);
  defeatPresentEnemies(b);
  assert.equal(b.kills, 9);
  assert.equal(b.phase, "victory");
  assert.equal(b.round, 5);
});

test("mission: a legal strategy clears all nine enemies within five rounds", () => {
  assert.ok(MISSION_WIN_STEPS.length > 0);
  const b = replayMission(new Battle(classicOptions()));
  assert.equal(b.phase, "victory");
  assert.equal(b.resultReason, "cleared");
  assert.equal(b.round, 5);
  assert.equal(b.kills, 9);
  assert.equal(b.enemies.length, 0);
  assert.equal(b.pendingReinforcements, 0);
  assert.equal(b.allies.length, 3);
  assert.ok(b.allies.every((ally) => ally.hp > 0));
});

test("mission: blocked reinforcement entrances defer enemies without losing progress", () => {
  const b = new Battle(classicOptions());
  b.allies.forEach((ally, index) => {
    ally.x = index + 2;
    ally.y = 3;
  });
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1)
        b.terrain[y][x] = "tree";
  defeatPresentEnemies(b);
  endTurn(b);
  assert.equal(b.round, 2);
  assert.equal(b.phase, "player");
  assert.equal(b.enemies.length, 0);
  assert.equal(b.pendingReinforcements, 6);
  b.terrain[7][7] = "grass";
  assert.equal(b.spawnReinforcements(), 1);
  assert.equal(b.pendingReinforcements, 5);
  assert.deepEqual({ x: b.enemies[0].x, y: b.enemies[0].y }, { x: 7, y: 7 });
});

test("mission: newly arriving enemies announce attacks before dealing any damage", () => {
  const b = new Battle(classicOptions());
  defeatPresentEnemies(b);
  const health = new Map(b.allies.map((ally) => [ally.id, ally.hp]));
  endTurn(b);
  assert.equal(b.enemies.length, 1);
  assert.ok(b.enemies[0].intent);
  for (const ally of b.allies) assert.equal(ally.hp, health.get(ally.id));
});

test("mission: the deadline resolves round five and never starts round six", () => {
  const b = new Battle(classicOptions());
  b.round = 5;
  for (const enemy of b.enemies) enemy.intent = null;
  endTurn(b);
  assert.equal(b.round, 5);
  assert.equal(b.phase, "defeat");
  assert.equal(b.resultReason, "timeout");
  assert.equal(b.beginEnemyTurn(), false);
  assert.equal(b.resolveEnemyTurn(), false);
});

test("mission: losing all allies takes precedence over the deadline", () => {
  const b = new Battle(classicOptions());
  b.round = 5;
  for (const ally of [...b.allies]) b.damage(ally, ally.hp);
  b.checkResult();
  assert.equal(b.phase, "defeat");
  assert.equal(b.resultReason, "eliminated");
});

test("mission: a dead enemy cannot increase the kill count twice", () => {
  const b = new Battle(classicOptions());
  const enemy = b.enemies[0];
  b.damage(enemy, enemy.hp);
  assert.equal(b.kills, 1);
  b.damage(enemy, 10);
  assert.equal(b.kills, 1);
  b.damage(b.allies[0], 1);
  assert.equal(b.kills, 1);
});

test("mission: reset restores deadline, progress, waves and the ranged enemy", () => {
  const b = new Battle(classicOptions());
  defeatPresentEnemies(b);
  endTurn(b);
  b.reset();
  assert.equal(b.round, 1);
  assert.equal(b.kills, 0);
  assert.equal(b.pendingReinforcements, 6);
  assert.equal(b.nextWaveCount, 1);
  assert.equal(b.phase, "player");
  assert.equal(b.resultReason, null);
  assert.equal(b.enemies.length, 3);
  assert.equal(b.enemies.filter((e) => e.kind === "ranged").length, 1);
});

test("mission: an isolated arena can opt out of waves and the round limit", () => {
  const b = arena();
  assert.equal(b.pendingReinforcements, 0);
  assert.equal(b.maxRounds, null);
  b.round = 5;
  b.enemies[0].intent = null;
  endTurn(b);
  assert.equal(b.round, 6);
  assert.equal(b.phase, "player");
  defeatPresentEnemies(b);
  assert.equal(b.phase, "victory");
});

test("ranged: a shot reaches four orthogonal cells, never a diagonal or fifth cell", () => {
  const b = arena();
  const enemy = b.enemies[0];
  assert.equal(b.enemyAttackValid(enemy), true);
  assert.equal(b.enemyAttackValid(enemy, { x: 1, y: 3 }), false);
  assert.equal(b.enemyAttackValid(enemy, { x: 2, y: 2 }), false);
  assert.equal(b.enemyAttackValid(enemy, { x: 6, y: 3 }), false);
  endTurn(b);
  assert.equal(b.allies[0].hp, 2);
});

test("ranged: a valid firing position stays in place while announcing its target", () => {
  const b = arena();
  b.enemies[0].intent = null;
  b.prepareEnemies();
  assert.deepEqual({ x: b.enemies[0].x, y: b.enemies[0].y }, { x: 6, y: 3 });
  assert.deepEqual(b.enemies[0].intent, { x: 2, y: 3 });
  assert.equal(
    b.visualEvents.some((event) => event.type === "enemy-move"),
    false,
  );
});

test("ranged: attacks target the announced cell rather than following an ally", () => {
  const b = arena();
  b.select("fire");
  assert.equal(b.move(2, 2), true);
  endTurn(b);
  assert.equal(b.allies[0].hp, 3);
});

test("ranged: an allied unit on the firing line intercepts the shot", () => {
  const b = arena();
  const intercepting = hero("water", 4, 3);
  b.units.push(intercepting);
  endTurn(b);
  assert.equal(intercepting.hp, 2);
  assert.equal(b.units.find((u) => u.id === "fire").hp, 3);
});

test("ranged: an enemy on the firing line also intercepts the shot", () => {
  const b = arena();
  const intercepting = foe("melee", 4, 3, "melee");
  intercepting.intent = null;
  b.units.push(intercepting);
  endTurn(b);
  assert.equal(intercepting.hp, 1);
  assert.equal(b.allies[0].hp, 3);
});

test("ranged: a barrier intercepts damage while trees and rocks block without damage", () => {
  for (const obstacle of ["tree", "rock", "barrier"]) {
    const b = arena();
    if (obstacle === "barrier")
      b.barrier = { x: 4, y: 3, hp: 2, maxHp: 2, type: obstacle };
    else b.terrain[3][4] = obstacle;
    const structure = b.structureAt(4, 3);
    assert.equal(b.enemyAttackValid(b.enemies[0]), false, obstacle);
    endTurn(b);
    assert.equal(b.allies[0].hp, 3, obstacle);
    assert.equal(structure.hp, obstacle === "barrier" ? 1 : 2, obstacle);
  }
});

test("ranged: sideways displacement moves the shot to a parallel row", () => {
  const b = arena();
  const archer = b.enemies[0];
  b.pushUnit(archer, { x: 6, y: 4 });
  assert.deepEqual(archer.intent, { x: 2, y: 4 });
  assert.equal(b.enemyAttackValid(archer), true);
  endTurn(b);
  assert.equal(b.allies[0].hp, 3);
});

test("ranged: displacement along the firing line preserves an in-range shot", () => {
  const b = arena();
  const archer = b.enemies[0];
  b.pushUnit(archer, { x: 5, y: 3 });
  assert.deepEqual(archer.intent, { x: 1, y: 3 });
  assert.deepEqual(b.enemyThreatenedCells(archer).at(-1), { x: 2, y: 3 });
  endTurn(b);
  assert.equal(b.allies[0].hp, 2);
});

test("ranged: displacement previews preserve the attack while moving its threatened row", () => {
  for (const [waterPosition, dodged] of [
    [{ x: 7, y: 3 }, false],
    [{ x: 6, y: 4 }, true],
  ]) {
    const b = arena();
    b.units.push(hero("water", waterPosition.x, waterPosition.y));
    b.select("water");
    b.setMode("special");
    const before = structuredClone(b);
    const preview = b.previewAction(waterPosition.x, waterPosition.y);
    assert.equal(preview.nextEnemies.length, 1);
    assert.equal(
      preview.units.find((unit) => unit.id === "ranged").kind,
      "ranged",
    );
    assert.equal(preview.nextEnemies[0].attackInterrupted, false);
    assert.deepEqual(structuredClone(b), before);
    assert.equal(b.act(waterPosition.x, waterPosition.y), true);
    endTurn(b);
    assert.equal(
      b.units.find((unit) => unit.id === "fire").hp,
      dodged ? 3 : 2,
    );
  }
});

test("ranged: the fifth-round displacement preview ends at the deadline", () => {
  const b = arena();
  b.maxRounds = 5;
  b.round = 5;
  b.units.push(hero("water", 7, 3));
  b.select("water");
  b.setMode("special");
  const before = structuredClone(b);
  const preview = b.previewAction(7, 3);
  assert.equal(preview.outcome, "player");
  assert.equal(preview.forecastPhase, "defeat");
  assert.equal(preview.forecastResultReason, "timeout");
  assert.equal(preview.nextEnemies[0].status, "battle-ended");
  assert.deepEqual(preview.nextEnemies[0].path, [{ x: 5, y: 3 }]);
  assert.deepEqual(structuredClone(b), before);
  assert.equal(b.act(7, 3), true);
  endTurn(b);
  assert.equal(b.phase, preview.forecastPhase);
  assert.equal(b.resultReason, preview.forecastResultReason);
  assert.equal(b.round, 5);
});

test("ranged: approach animation paths are orthogonal and limited to two cells", () => {
  const b = arena();
  b.units[0].x = 0;
  b.units[0].y = 0;
  b.units[1].x = 7;
  b.units[1].y = 7;
  b.prepareEnemies();
  const movement = b.visualEvents.find((event) => event.type === "enemy-move");
  assert.ok(movement);
  assert.ok(movement.path.length <= 3);
  for (let index = 1; index < movement.path.length; index++) {
    assert.equal(distance(movement.path[index - 1], movement.path[index]), 1);
  }
});
