import test from "node:test";
import assert from "node:assert/strict";
import { Battle, DIRECTIONS } from "../src/engine.js";

function scene(kind = "melee") {
  const b = new Battle({
    terrain: Array.from({ length: 8 }, () => Array(8).fill("grass")),
    waves: false,
    maxRounds: null,
    seed: "direction",
  });
  const actor = b.allies.find((u) => u.id === "water");
  const victim = b.allies.find((u) => u.id === "fire");
  const enemy = b.enemies.find((u) => u.kind === kind);
  Object.assign(actor, { x: 2, y: 3 });
  Object.assign(victim, { x: 4, y: 2 });
  Object.assign(enemy, { x: 3, y: 3, hp: 3, maxHp: 3, intent: { x: 3, y: 2 } });
  b.units = [actor, victim, enemy];
  b.selectedId = actor.id;
  b.visualEvents = [];
  return { b, actor, victim, enemy };
}

for (const mode of ["wave", "punch"])
  test(`${mode}: a surviving enemy retains its direction and hits the new cell rather than its original target`, () => {
    for (const kind of ["melee", "ranged"])
      for (const [dx, dy] of DIRECTIONS) {
        const s = scene(kind);
        const { b, actor, victim, enemy } = s;
        const shift = { x: -dy, y: dx };
        Object.assign(enemy, { x: 3, y: 3, intent: { x: 3 + dx, y: 3 + dy } });
        Object.assign(actor, { x: 3 - shift.x, y: 3 - shift.y });
        Object.assign(victim, { x: 3 + shift.x + dx, y: 3 + shift.y + dy });
        const original = { ...enemy.intent };
        const p = b.previewAction(
          mode === "wave" ? actor.x : enemy.x,
          mode === "wave" ? actor.y : enemy.y,
          mode === "wave" ? "special" : "punch",
        );
        assert.ok(p);
        const moved = p.units.find((u) => u.id === enemy.id);
        assert.deepEqual(moved.intent, {
          x: original.x + shift.x,
          y: original.y + shift.y,
        });
        assert.deepEqual(moved.attackCells, [{ x: victim.x, y: victim.y }]);
        assert.equal(p.nextEnemies[0].attackInterrupted, false);
        assert.deepEqual(enemy.intent, original);
        assert.equal(
          mode === "wave" ? b.wave() : b.punch(enemy.x, enemy.y),
          true,
        );
        b.beginEnemyTurn();
        b.resolveEnemyTurn();
        assert.equal(victim.hp, 2);
        assert.equal(actor.hp, 3);
        assert.deepEqual(b.lastEffect.strikes[0].to, {
          x: victim.x,
          y: victim.y,
        });
        assert.equal(b.lastEffect.strikes[0].cancelled, undefined);
      }
  });

test("a ranged attack pushed near the edge keeps its direction and is clipped to the board", () => {
  const { b, enemy, victim } = scene("ranged");
  Object.assign(enemy, { x: 2, y: 3, intent: { x: -2, y: 3 } });
  Object.assign(victim, { x: 0, y: 3 });
  b.pushUnit(enemy, { x: 1, y: 3 });
  assert.deepEqual(enemy.intent, { x: -3, y: 3 });
  assert.deepEqual(b.enemyAttackPath(enemy), [{ x: 0, y: 3 }]);
  b.beginEnemyTurn();
  b.resolveEnemyTurn();
  assert.equal(victim.hp, 2);
});

test("multiple pushes never rotate a melee attack, including at the edge", () => {
  const { b, enemy } = scene();
  enemy.intent = { x: 4, y: 3 };
  b.pushUnit(enemy, { x: 7, y: 3 });
  assert.deepEqual(enemy.intent, { x: 8, y: 3 });
  assert.deepEqual(b.enemyThreatenedCells(enemy), []);
  b.pushUnit(enemy, { x: 6, y: 3 });
  assert.deepEqual(enemy.intent, { x: 7, y: 3 });
  assert.deepEqual(b.enemyThreatenedCells(enemy), [{ x: 7, y: 3 }]);
});

test("a defeated displaced enemy never executes its armed attack", () => {
  const { b, enemy, victim } = scene();
  enemy.hp = 1;
  const actor = b.selected;
  Object.assign(actor, { x: 2, y: 3 });
  b.punch(3, 3);
  b.beginEnemyTurn();
  b.resolveEnemyTurn();
  assert.equal(victim.hp, 3);
  assert.equal(b.kills, 1);
  assert.ok(!b.enemies.length);
});

test("each surviving enemy emits movement and a prepared attack each round, including ranged shots without a visible ally", () => {
  const { b, actor, victim, enemy } = scene("ranged");
  Object.assign(actor, { x: 0, y: 0, hp: 100, maxHp: 100 });
  Object.assign(victim, { x: 0, y: 1, hp: 100, maxHp: 100 });
  Object.assign(enemy, { x: 7, y: 7, intent: null });
  b.prepareEnemies();
  for (let round = 1; round <= 3; round++) {
    assert.equal(b.round, round);
    assert.ok(enemy.intent);
    assert.ok(b.enemyAttackInRange(enemy));
    assert.ok(
      b.visualEvents.some((e) => e.type === "enemy-ready" && e.id === enemy.id),
    );
    if (enemy.advanceSteps) {
      const movement = b.visualEvents.find(
        (e) => e.type === "enemy-move" && e.id === enemy.id,
      );
      assert.equal(movement.path.length - 1, enemy.advanceSteps);
      assert.ok(enemy.advanceSteps <= 2);
    }
    b.visualEvents = [];
    b.beginEnemyTurn();
    b.resolveEnemyTurn();
  }
});
